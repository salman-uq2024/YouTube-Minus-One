import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

import { getRelatedVideos } from '@/lib/youtube';

const originalKey = process.env.YT_API_KEY;

describe('getRelatedVideos', () => {
  beforeEach(() => {
    process.env.YT_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalKey === undefined) {
      delete process.env.YT_API_KEY;
    } else {
      process.env.YT_API_KEY = originalKey;
    }
  });

  it('requests related videos with required parameters', async () => {
    const searchResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: { videoId: 'abc123' }
          }
        ],
        nextPageToken: null
      })
    };

    const videosResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: 'abc123',
            contentDetails: { duration: 'PT2M10S' },
            snippet: {
              title: 'Sample video',
              description: 'Description',
              thumbnails: {},
              channelTitle: 'Channel',
              publishedAt: new Date().toISOString(),
              channelId: 'channel-1'
            },
            statistics: { viewCount: '1000', likeCount: '50' }
          }
        ]
      })
    };

    const channelsResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: 'channel-1',
            snippet: {
              title: 'Channel',
              thumbnails: {
                default: { url: 'https://example.com/avatar-default.jpg' }
              }
            }
          }
        ]
      })
    };

    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockImplementationOnce(async (input: RequestInfo | URL) => searchResponse as unknown as Response)
      .mockImplementationOnce(async (input: RequestInfo | URL) => videosResponse as unknown as Response)
      .mockImplementationOnce(async (input: RequestInfo | URL) => channelsResponse as unknown as Response);

    const result = await getRelatedVideos('video987');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const firstCallUrl = String(fetchMock.mock.calls[0][0]);
    expect(firstCallUrl).toContain('search');
    expect(firstCallUrl).toContain('type=video');
    expect(firstCallUrl).toContain('relatedToVideoId=video987');
    expect(firstCallUrl).not.toContain('q=');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('abc123');
    expect(result.items[0].channelAvatarUrl).toBe('https://example.com/avatar-default.jpg');
  });
});
