import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class QdrantService implements OnModuleInit {
    private readonly logger = new Logger(QdrantService.name);
    private client: QdrantClient;
    private readonly postCollectionName = 'post_embedding';
    private readonly questionCollectionName = 'question_answer';
    private readonly vectorSize = 1024; // BAAI/bge-m3 model produces 1024-dimensional embeddings

    // trạng thái để tránh tạo nhiều lần khi concurrent
    private collectionReady = false;
    private ensurePromise?: Promise<void>;

    constructor() {
        this.client = new QdrantClient({
            url: process.env.QDRANT_URL || 'http://localhost:6333',
            apiKey: process.env.QDRANT_API_KEY
        });
    }

    async onModuleInit() {
        try {
            await this.ensureCollection();
            this.logger.log('✅ Qdrant service initialized successfully');
        } catch (err) {
            this.logger.error('❌ Failed to ensure Qdrant collection on init', err);
        }
    }

    // ========== COLLECTION MANAGEMENT ==========

    private async ensureCollection(): Promise<void> {
        if (this.collectionReady) return;
        if (this.ensurePromise) return this.ensurePromise;

        this.ensurePromise = (async () => {
            try {
                // Kiểm tra và tạo collection postEmbedding
                await this.ensureCollectionExists(this.postCollectionName);

                // Kiểm tra và tạo collection questionAnswer
                await this.ensureCollectionExists(this.questionCollectionName);

                this.logger.log('✅ All collections ready');

            } catch (error) {
                this.logger.error('❌ Error ensuring collections:', error);
                throw error;
            } finally {
                this.collectionReady = true;
                this.ensurePromise = undefined;
            }
        })();

        return this.ensurePromise;
    }

    private async ensureCollectionExists(collectionName: string): Promise<void> {
        try {
            // Thử get collection
            const collection = await this.client.getCollection(collectionName);

            // Kiểm tra cấu hình vector
            const vectorConfig = collection.config?.params?.vectors;

            // Nếu collection có named vector (key rỗng hoặc bất kỳ), XÓA và tạo lại
            if (vectorConfig && typeof vectorConfig === 'object' && !vectorConfig.size) {
                this.logger.warn(`⚠️  Collection "${collectionName}" has incorrect vector config, recreating...`);

                await this.client.deleteCollection(collectionName);
                this.logger.log(`🗑️  Deleted old collection "${collectionName}"`);

                await this.createCollectionCorrectly(collectionName);
            } else {
                this.logger.log(`✅ Collection "${collectionName}" exists with correct config`);
            }

        } catch (err: any) {
            if (err.status === 404) {
                this.logger.log(`⚠️  Collection "${collectionName}" not found, creating...`);
                await this.createCollectionCorrectly(collectionName);
            } else {
                throw err;
            }
        }
    }

    private async createCollectionCorrectly(collectionName: string): Promise<void> {
        try {
            await this.client.createCollection(collectionName, {
                vectors: {
                    size: this.vectorSize,
                    distance: 'Cosine',
                },
                optimizers_config: {
                    indexing_threshold: 10000,
                },
                hnsw_config: {
                    m: 16,
                    ef_construct: 100,
                },
            });

            this.logger.log(`✅ Created collection "${collectionName}" with correct config`);

            // Verify config
            const collection = await this.client.getCollection(collectionName);
            this.logger.log(`   Vector config: ${JSON.stringify(collection.config?.params?.vectors)}`);

        } catch (createErr: any) {
            if (createErr.status === 409) {
                this.logger.log(`ℹ️  Collection "${collectionName}" already exists (concurrent creation)`);
            } else {
                throw createErr;
            }
        }
    }

    // ========== VECTOR NORMALIZATION ==========

    private normalizeVector(vec: any): number[] {
        if (!Array.isArray(vec)) {
            this.logger.error('❌ Embedding is not an array:', typeof vec);
            throw new Error('Embedding is not an array');
        }

        // nếu trường hợp embedding là [[...]] (1-element wrapper), unwrap
        if (vec.length === 1 && Array.isArray(vec[0])) {
            this.logger.log('ℹ️  Unwrapping nested array');
            vec = vec[0];
        }

        const arr = vec.map((v: any, idx: number) => {
            const n = Number(v);
            if (Number.isNaN(n) || !isFinite(n)) {
                this.logger.error(`❌ Invalid value at index ${idx}: ${v}`);
                throw new Error(`Embedding contains NaN or infinite at index ${idx}`);
            }
            return n;
        });

        if (arr.length !== this.vectorSize) {
            this.logger.error(`❌ Dimension mismatch: got ${arr.length}, expected ${this.vectorSize}`);
            throw new Error(`Embedding dimension mismatch: got ${arr.length}, expected ${this.vectorSize}`);
        }

        return arr;
    }

    // ========== PAYLOAD HANDLING ==========

    private flattenPayload(input: any, prefix = '', depth = 0): Record<string, any> {
        const flat: Record<string, any> = {};

        if (!input || typeof input !== 'object') {
            return {};
        }

        // Giới hạn depth để tránh recursion vô hạn
        if (depth > 3) {
            flat[prefix ? `${prefix}_json` : 'payload_json'] =
                JSON.stringify(input).substring(0, 1000);
            return flat;
        }

        for (const [key, value] of Object.entries(input)) {
            const newKey = prefix ? `${prefix}_${key}` : key;

            if (value === undefined || value === null) {
                continue;
            }

            // String - cắt ngắn và đảm bảo valid UTF-8
            if (typeof value === 'string') {
                // Loại bỏ ký tự control và cắt ngắn
                const cleanString = value
                    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control chars
                    .substring(0, 1000);
                flat[newKey] = cleanString;
                continue;
            }

            // Number - chỉ lấy finite numbers
            if (typeof value === 'number') {
                if (Number.isFinite(value) && !Number.isNaN(value)) {
                    flat[newKey] = value;
                }
                continue;
            }

            // Boolean
            if (typeof value === 'boolean') {
                flat[newKey] = value;
                continue;
            }

            // Date -> ISO string
            if (value instanceof Date) {
                flat[newKey] = value.toISOString();
                continue;
            }

            // Array - chỉ lấy primitive types
            if (Array.isArray(value)) {
                if (value.length === 0) {
                    continue;
                }

                // Chỉ xử lý arrays của primitive types
                const isPrimitiveArray = value.every(item =>
                    typeof item === 'string' ||
                    typeof item === 'number' ||
                    typeof item === 'boolean' ||
                    item === null
                );

                if (isPrimitiveArray) {
                    const limited = value.slice(0, 100);
                    flat[`${newKey}_json`] = JSON.stringify(limited);
                    flat[`${newKey}_length`] = value.length;
                } else {
                    // Complex array -> stringify to JSON
                    flat[`${newKey}_json`] = JSON.stringify(value.slice(0, 50)).substring(0, 1000);
                }
                continue;
            }

            // Object -> flatten recursively
            if (typeof value === 'object') {
                const nested = this.flattenPayload(value, newKey, depth + 1);
                Object.assign(flat, nested);
                continue;
            }

            // Mọi thứ khác -> convert to string
            flat[newKey] = String(value).substring(0, 1000);
        }

        return flat;
    }
    private sanitizePayload(input: any): any {
        return this.flattenPayload(input);
    }

    // ========== UPSERT OPERATIONS ==========

    async upsertPost(postId: string, vector: any, payload: any) {
        await this.ensureCollection();

        let safeId: string;
        if (/^[a-fA-F0-9]{24}$/.test(postId)) {
            safeId = uuidv4();
        } else {
            safeId = postId;
        }

        const vec = this.normalizeVector(vector);
        const safePayload = this.sanitizePayload(payload);

        return await this.client.upsert(this.postCollectionName, {
            wait: true,
            points: [
                {
                    id: safeId,
                    vector: vec,
                    payload: {
                        ...safePayload,
                        postId: postId,
                    },
                },
            ],
        });
    }

    private validateId(id: string | number): string | number {
        // Nếu là number, đảm bảo là integer không âm
        if (typeof id === 'number') {
            if (!Number.isInteger(id) || id < 0) {
                throw new Error(`Invalid ID: ${id}. Integer IDs must be non-negative integers`);
            }
            return id;
        }

        // Nếu là string, kiểm tra format
        if (typeof id === 'string') {
            // Kiểm tra UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(id)) {
                return id;
            }

            // Kiểm tra numeric string
            if (/^\d+$/.test(id)) {
                const numId = parseInt(id, 10);
                if (numId >= 0) {
                    return numId; // Convert thành number
                }
            }

            // Nếu không phải UUID hoặc numeric string, tạo UUID mới
            this.logger.warn(`⚠️  ID "${id}" is not valid UUID or integer. Generating new UUID`);
            return uuidv4();
        }

        throw new Error(`Invalid ID type: ${typeof id}. Must be string or number`);
    }

    async upsertQuestion(questionId: string, vector: any, payload: any) {
        try {
            this.logger.log(`📝 Upserting question: ${questionId}`);

            await this.ensureCollection();

            if (!questionId || typeof questionId !== 'string' || questionId.trim().length === 0) {
                throw new Error('Invalid questionId: must be non-empty string');
            }

            // FIX: Sử dụng validateId thay vì logic cũ
            const safeId = this.validateId(questionId);
            this.logger.log(`   Using validated ID: ${safeId} (type: ${typeof safeId})`);

            // Normalize vector
            const vec = this.normalizeVector(vector);
            this.logger.log(`   ✅ Vector normalized: ${vec.length} dimensions`);

            // Flatten payload
            const flatPayload = this.flattenPayload(payload);
            this.logger.log(`   ✅ Payload flattened: ${Object.keys(flatPayload).length} keys`);
            this.logger.debug(`   📦 Flat payload: ${JSON.stringify(flatPayload).substring(0, 500)}`);

            const payloadSize = Buffer.byteLength(JSON.stringify(flatPayload), 'utf8');
            this.logger.log(`   📏 Payload size: ${payloadSize} bytes`);

            // Upsert
            this.logger.log(`   Upserting to collection "${this.questionCollectionName}"...`);

            const result = await this.client.upsert(this.questionCollectionName, {
                wait: true,
                points: [{
                    id: safeId, // Đã được validate
                    vector: vec,
                    payload: flatPayload,
                }],
            });

            this.logger.log(`✅ Upsert successful: ${safeId}`);
            this.logger.log(`   Operation ID: ${result.operation_id}`);
            this.logger.log(`   Status: ${result.status}`);

            return {
                success: true,
                questionId: String(safeId),
                operation_id: result.operation_id,
                status: result.status,
            };

        } catch (error) {
            this.logger.error(`❌ Error in upsertQuestion:`, error);
            this.logger.error(`   questionId: ${questionId}`);
            this.logger.error(`   error.message: ${error.message}`);
            this.logger.error(`   error.name: ${error.name}`);

            // Enhanced error logging
            this.logger.error(`   error.status: ${error.status}`);
            this.logger.error(`   error.statusText: ${error.statusText}`);
            this.logger.error(`   error.data: ${JSON.stringify(error.data || {})}`);
            this.logger.error(`   error.response: ${JSON.stringify(error.response || {})}`);

            // Full error object
            this.logger.error(`   Full error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);

            throw error;
        }
    }


    // ========== SEARCH OPERATIONS ==========

    async findSimilarPostsQdrant(
        queryVector: number[],
        limit = 5,
        minSimilarity = 0.5,
        postId?: string
    ) {
        this.logger.log(`QdrantService: Searching similar posts with limit=${limit}, minSimilarity=${minSimilarity}, exclude postId=${postId}`);

        const searchLimit = postId ? limit + 10 : limit;

        const results = await this.client.search(this.postCollectionName, {
            vector: this.normalizeVector(queryVector),
            limit: searchLimit,
            score_threshold: minSimilarity,
        });

        if (results.length === 0) {
            this.logger.log('QdrantService: No similar posts found');
            return [];
        }

        let filteredResults = results;
        if (postId) {
            filteredResults = results.filter(r => r.payload?.postId !== postId);
        }

        filteredResults = filteredResults.slice(0, limit);

        this.logger.log(`QdrantService: Found ${filteredResults.length} similar posts`);

        return filteredResults.map((r) => ({
            postId: r.payload?.postId,
            similarity: r.score,
        }));
    }

    async findSimilarQuestionsQdrant(
        queryVector: number[],
        limit = 5,
        minSimilarity = 0.5
    ) {
        this.logger.log(
            `QdrantService: Searching similar questions limit=${limit}, minSimilarity=${minSimilarity}`
        );

        const results = await this.client.search(this.questionCollectionName, {
            vector: this.normalizeVector(queryVector),
            limit,
            score_threshold: minSimilarity,
        });

        if (!results.length) return [];

        return results.map((r) => ({
            questionId: r.payload?.questionId,
            similarity: r.score,
            payload: r.payload,
        }));
    }

    // ========== UTILITY OPERATIONS ==========

    async testSimpleUpsert() {
        try {
            this.logger.log('🧪 Testing simple upsert...');

            await this.ensureCollection();

            // FIX: Thêm bước verify và fix collection config
            await this.verifyAndFixCollectionConfig();

            // Tạo vector đơn giản - ĐẢM BẢO đúng size 1024
            const testVector = new Array(this.vectorSize).fill(0).map(() => Math.random() * 2 - 1); // Range [-1, 1]

            // FIX: Sử dụng UUID hoặc integer thay vì string custom
            const testId = uuidv4(); // Dùng UUID thực sự
            // HOẶC: const testId = Date.now(); // Dùng integer

            const testPayload = {
                test: 'simple',
                value: 123,
                timestamp: new Date().toISOString(),
                boolean_field: true,
                string_field: 'test string'
            };

            this.logger.log(`   ID: ${testId} (type: ${typeof testId})`);
            this.logger.log(`   Vector length: ${testVector.length}`);
            this.logger.log(`   Vector sample (first 5): [${testVector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
            this.logger.log(`   Original payload: ${JSON.stringify(testPayload)}`);

            // FIX: Sử dụng flattenPayload
            const flatPayload = this.flattenPayload(testPayload);
            this.logger.log(`   Flat payload keys: ${Object.keys(flatPayload).join(', ')}`);
            this.logger.log(`   Flat payload values: ${JSON.stringify(flatPayload)}`);

            // Kiểm tra payload size
            const payloadSize = Buffer.byteLength(JSON.stringify(flatPayload), 'utf8');
            this.logger.log(`   Payload size: ${payloadSize} bytes`);

            if (payloadSize > 64000) {
                throw new Error(`Payload too large: ${payloadSize} bytes`);
            }

            const result = await this.client.upsert(this.questionCollectionName, {
                wait: true,
                points: [{
                    id: testId, // Bây giờ là UUID hợp lệ
                    vector: testVector,
                    payload: flatPayload,
                }],
            });

            this.logger.log(`✅ Test upsert successful!`);
            this.logger.log(`   Operation ID: ${result.operation_id}`);
            this.logger.log(`   Status: ${JSON.stringify(result.status)}`);

            // Verify điểm đã được lưu
            try {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const retrieved = await this.client.retrieve(this.questionCollectionName, {
                    ids: [testId],
                    with_payload: true,
                });

                if (retrieved.length > 0) {
                    this.logger.log(`   ✅ Verified: Point stored successfully`);
                    this.logger.log(`   Retrieved payload keys: ${Object.keys(retrieved[0].payload || {}).join(', ')}`);
                } else {
                    this.logger.warn(`   ⚠️  Point not found after upsert`);
                }
            } catch (verifyError) {
                this.logger.warn(`   ⚠️  Could not verify: ${verifyError.message}`);
            }

            return {
                success: true,
                operation_id: result.operation_id,
                status: result.status,
                testId
            };

        } catch (error) {
            this.logger.error(`❌ Test upsert failed:`, error);
            this.logger.error(`   Error message: ${error.message}`);
            this.logger.error(`   Error status: ${error.status || 'N/A'}`);
            this.logger.error(`   Error statusText: ${error.statusText || 'N/A'}`);

            // Log thêm chi tiết nếu có
            if (error.data) {
                this.logger.error(`   Error data: ${JSON.stringify(error.data)}`);
            }

            throw error;
        }
    }


    private async verifyAndFixCollectionConfig(): Promise<void> {
        try {
            const collection = await this.client.getCollection(this.questionCollectionName);
            const vectorConfig = collection.config?.params?.vectors;

            this.logger.log(`🔍 Collection config: ${JSON.stringify(vectorConfig)}`);

            // Nếu collection config là named vectors (không có size), cần recreate
            if (vectorConfig && typeof vectorConfig === 'object' && !vectorConfig.size) {
                this.logger.warn(`⚠️  Detected named vectors config, recreating collection...`);

                await this.client.deleteCollection(this.questionCollectionName);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for deletion

                await this.createCollectionCorrectly(this.questionCollectionName);
                this.logger.log(`✅ Collection recreated with correct config`);
            }

        } catch (error) {
            this.logger.error(`❌ Failed to verify collection config:`, error);
            throw error;
        }
    }


    async deleteAll() {
        this.logger.warn("⚠️  Deleting all Qdrant collections...");

        try {
            await this.client.deleteCollection(this.postCollectionName);
        } catch (err) {
            this.logger.warn(`Collection ${this.postCollectionName} already deleted or doesn't exist`);
        }

        try {
            await this.client.deleteCollection(this.questionCollectionName);
        } catch (err) {
            this.logger.warn(`Collection ${this.questionCollectionName} already deleted or doesn't exist`);
        }

        await this.createCollectionCorrectly(this.postCollectionName);
        await this.createCollectionCorrectly(this.questionCollectionName);

        this.collectionReady = false;
        await this.ensureCollection();

        this.logger.log('✅ All Qdrant collections reset.');
        return { message: 'All Qdrant collections reset.' };
    }

    async deleteById(postId: string) {
        const safeId = String(postId);
        await this.client.delete(this.postCollectionName, {
            points: [safeId],
        });
        this.logger.log(`✅ Deleted post: ${postId}`);
        return { message: `Post with ID ${postId} deleted from Qdrant.` };
    }
}