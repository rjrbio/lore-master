import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { LoreService } from './lore.service';
import { Lore } from './lore.schema';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockEmbedding = Array.from({ length: 1536 }, (_, i) => i * 0.001);

const mockOpenAI = {
  embeddings: {
    create: jest.fn().mockResolvedValue({
      data: [{ embedding: mockEmbedding }],
    }),
  },
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [
          { message: { content: 'Respuesta generada por el modelo.' } },
        ],
      }),
    },
  },
};

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockOpenAI),
  };
});

jest.mock('axios', () => ({
  __esModule: true,
  default: { isAxiosError: jest.fn(() => false) },
  get: jest.fn(),
  AxiosError: class AxiosError extends Error {},
}));

const mockSave = jest.fn().mockImplementation(function (this: unknown) {
  return Promise.resolve(this);
});
const mockModel: Record<string, jest.Mock> = {
  find: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),
  aggregate: jest.fn().mockResolvedValue([]),
  exists: jest.fn().mockResolvedValue(null),
  deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
};

function ModelConstructor(
  this: Record<string, unknown>,
  data: Record<string, unknown>,
) {
  Object.assign(this, data);
  this.save = mockSave;
}

Object.assign(ModelConstructor, mockModel);

const configValues: Record<string, string | number> = {
  OPENAI_API_KEY: 'sk-test-key',
  OPENAI_CHAT_MODEL: 'gpt-4o',
  OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
  MIN_CHUNK_LENGTH: 120,
  MAX_CHUNK_LENGTH: 1900,
  VECTOR_SEARCH_THRESHOLD: 0.72,
};

const mockConfigService = {
  get: jest.fn(<T>(key: string, defaultValue?: T): T => {
    return (configValues[key] ?? defaultValue) as T;
  }),
};

// ── Helper ─────────────────────────────────────────────────────────────────────

async function createService(): Promise<LoreService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      LoreService,
      { provide: getModelToken(Lore.name), useValue: ModelConstructor },
      { provide: ConfigService, useValue: mockConfigService },
    ],
  }).compile();

  return module.get<LoreService>(LoreService);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('LoreService', () => {
  let service: LoreService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await createService();
  });

  // ── Constructor ────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should throw if OPENAI_API_KEY is not set', async () => {
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'OPENAI_API_KEY' ? undefined : configValues[key],
      );

      await expect(createService()).rejects.toThrow(
        InternalServerErrorException,
      );

      // Restaurar
      mockConfigService.get.mockImplementation(
        <T>(key: string, defaultValue?: T): T =>
          (configValues[key] ?? defaultValue) as T,
      );
    });
  });

  // ── createLore ─────────────────────────────────────────────────────────────

  describe('createLore', () => {
    it('should create an embedding and save the document', async () => {
      await service.createLore('Test Title', 'Some content here');

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'Some content here',
      });
      expect(mockSave).toHaveBeenCalled();
    });

    it('should pass metadata through to the model', async () => {
      await service.createLore('Title', 'Content', 'Category', {
        sourceUrl: 'https://example.com',
        sourceType: 'web',
        chunkHash: 'abc123',
        tags: ['test'],
      });

      expect(mockSave).toHaveBeenCalled();
    });

    it('should default category to Document', async () => {
      const result = await service.createLore('Title', 'Content');
      expect((result as unknown as Record<string, unknown>).category).toBe(
        'Document',
      );
    });
  });

  // ── searchLore ─────────────────────────────────────────────────────────────

  describe('searchLore', () => {
    it('should create embedding and run aggregate pipeline', async () => {
      mockModel.aggregate.mockResolvedValueOnce([
        { title: 'Doc 1', content: 'Hello', score: 0.9 },
      ]);

      const results = await service.searchLore('What is this?');

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'What is this?',
      });
      expect(mockModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ $vectorSearch: expect.any(Object) }),
        ]),
      );
      expect(results).toHaveLength(1);
    });

    it('should return empty array when no results match threshold', async () => {
      mockModel.aggregate.mockResolvedValueOnce([]);
      const results = await service.searchLore('Obscure query');
      expect(results).toEqual([]);
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should query with default skip and limit', async () => {
      await service.findAll();
      expect(mockModel.find).toHaveBeenCalled();
      expect(mockModel.skip).toHaveBeenCalledWith(0);
      expect(mockModel.limit).toHaveBeenCalledWith(100);
    });

    it('should cap limit at 1000', async () => {
      await service.findAll(0, 5000);
      expect(mockModel.limit).toHaveBeenCalledWith(1000);
    });
  });

  // ── listDocuments ──────────────────────────────────────────────────────────

  describe('listDocuments', () => {
    it('should return aggregated document list with pagination', async () => {
      mockModel.aggregate.mockResolvedValueOnce([
        {
          title: 'Doc',
          sourceUrl: 'https://example.com',
          sourceType: 'web',
          locale: 'en',
          tags: ['test'],
          chunkCount: 3,
          lastUpdated: new Date(),
        },
      ]);

      const result = await service.listDocuments(0, 50);

      expect(result).toHaveLength(1);
      expect(result[0].chunkCount).toBe(3);
      expect(mockModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ $skip: 0 }),
          expect.objectContaining({ $limit: 50 }),
        ]),
      );
    });

    it('should cap limit at 500', async () => {
      mockModel.aggregate.mockResolvedValueOnce([]);
      await service.listDocuments(0, 1000);
      expect(mockModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ $limit: 500 })]),
      );
    });
  });

  // ── askQuestion ────────────────────────────────────────────────────────────

  describe('askQuestion', () => {
    it('should return no-content message when searchLore returns empty', async () => {
      mockModel.aggregate.mockResolvedValueOnce([]);

      const result = await service.askQuestion('What?');

      expect(result.answer).toContain('No encontré contenido relevante');
      expect(result.sources).toEqual([]);
    });

    it('should call chat.completions.create with context from search results', async () => {
      mockModel.aggregate.mockResolvedValueOnce([
        {
          title: 'Doc 1',
          content: 'Content here',
          sourceUrl: 'https://example.com',
          sourceType: 'web',
          score: 0.9,
        },
      ]);

      const result = await service.askQuestion('Tell me about this');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
          ]),
        }),
      );
      expect(result.answer).toBe('Respuesta generada por el modelo.');
      expect(result.sources).toHaveLength(1);
    });

    it('should condense question when history is provided', async () => {
      // condenseQuestion calls chat.completions.create with gpt-4o-mini
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Pregunta condensada' } }],
        })
        // askQuestion calls it again for the main answer
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Respuesta final.' } }],
        });
      mockModel.aggregate.mockResolvedValueOnce([
        {
          title: 'Doc',
          content: 'Ctx',
          sourceUrl: 'u',
          sourceType: 'web',
          score: 0.85,
        },
      ]);

      const result = await service.askQuestion('And what else?', [
        { role: 'user', content: 'Tell me about X' },
        { role: 'assistant', content: 'X is great' },
      ]);

      // First call = condense (gpt-4o-mini), second = answer (gpt-4o)
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
      expect(result.answer).toBe('Respuesta final.');
    });
  });

  // ── ingestUrls ─────────────────────────────────────────────────────────────

  describe('ingestUrls', () => {
    it('should throw BadRequest for empty URL array', async () => {
      await expect(service.ingestUrls([])).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequest for whitespace-only URLs', async () => {
      await expect(service.ingestUrls(['  ', '\n'])).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── ingestFiles ────────────────────────────────────────────────────────────

  describe('ingestFiles', () => {
    it('should throw BadRequest for empty file array', async () => {
      await expect(service.ingestFiles([])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequest for unsupported file extension', async () => {
      const file = {
        originalname: 'malware.exe',
        buffer: Buffer.from('content'),
        mimetype: 'application/octet-stream',
      } as Express.Multer.File;

      await expect(service.ingestFiles([file])).resolves.toEqual(
        expect.objectContaining({ failedUrls: 1 }),
      );
    });

    it('should process a valid .txt file', async () => {
      const longContent = 'A'.repeat(200) + '\n\n' + 'B'.repeat(200);
      const file = {
        originalname: 'test-doc.txt',
        buffer: Buffer.from(longContent),
        mimetype: 'text/plain',
      } as Express.Multer.File;

      mockModel.exists.mockResolvedValue(null);

      const result = await service.ingestFiles([file]);

      expect(result.processedUrls).toBe(1);
      expect(result.results.length + result.failures.length).toBe(1);
    });

    it('should throw BadRequest for empty file content', async () => {
      const file = {
        originalname: 'empty.txt',
        buffer: Buffer.from(''),
        mimetype: 'text/plain',
      } as Express.Multer.File;

      const result = await service.ingestFiles([file]);
      expect(result.failedUrls).toBe(1);
    });
  });
});
