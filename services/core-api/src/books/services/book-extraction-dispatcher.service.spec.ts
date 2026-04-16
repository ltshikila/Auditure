import { BookExtractionDispatcher } from './book-extraction-dispatcher.service';

// Mock @google-cloud/run before importing the service
const mockRunJob = jest.fn();
jest.mock('@google-cloud/run', () => ({
    JobsClient: jest.fn().mockImplementation(() => ({
        runJob: mockRunJob,
    })),
}));

describe('BookExtractionDispatcher', () => {
    let dispatcher: BookExtractionDispatcher;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.GCP_PROJECT_ID = 'test-project';
        process.env.GCP_REGION = 'us-central1';
        process.env.BOOK_EXTRACTOR_JOB_NAME = 'book-extractor';
        dispatcher = new BookExtractionDispatcher();
    });

    afterEach(() => {
        delete process.env.GCP_PROJECT_ID;
        delete process.env.GCP_REGION;
        delete process.env.BOOK_EXTRACTOR_JOB_NAME;
    });

    it('should be instantiable', () => {
        expect(dispatcher).toBeDefined();
    });

    describe('dispatch', () => {
        it('should call Cloud Run Jobs API with BOOK_ID env override', async () => {
            mockRunJob.mockResolvedValue([{ name: 'projects/test-project/locations/us-central1/jobs/book-extractor/executions/abc123' }]);

            await dispatcher.dispatch('book-xyz');

            expect(mockRunJob).toHaveBeenCalledWith({
                name: 'projects/test-project/locations/us-central1/jobs/book-extractor',
                overrides: {
                    containerOverrides: [
                        {
                            env: [{ name: 'BOOK_ID', value: 'book-xyz' }],
                        },
                    ],
                },
            });
        });

        it('should throw if Cloud Run Jobs API fails', async () => {
            mockRunJob.mockRejectedValue(new Error('Quota exceeded'));

            await expect(dispatcher.dispatch('book-xyz')).rejects.toThrow('Quota exceeded');
        });
    });
});
