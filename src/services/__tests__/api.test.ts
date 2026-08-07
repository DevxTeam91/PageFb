import { fetchConversations, sendReply } from '../api';

// Mock the global fetch
global.fetch = jest.fn();

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetchConversations calls the correct endpoint and returns data', async () => {
    const mockConversations = [{ id: '1', userName: 'Test User' }];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ conversations: mockConversations }),
    });

    const result = await fetchConversations();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/conversations'), undefined);
    expect(result).toEqual(mockConversations);
  });

  it('sendReply sends a POST request with the text', async () => {
    const mockResponse = { message: { text: 'Hello' }, conversation: { id: '1' } };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await sendReply('1', 'Hello');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/conversations/1/reply'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello' }),
    });
    expect(result).toEqual(mockResponse);
  });
});
