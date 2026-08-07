import React from 'react';
import renderer from 'react-test-renderer';
import { InboxScreen } from '../InboxScreen';

// Mock dependencies
jest.mock('../../context/GlobalStateContext', () => ({
  useGlobalState: () => ({
    conversations: [
      {
        id: '1',
        psid: '123456',
        userName: 'John Doe',
        unread: true,
        autoReplyEnabled: true,
        lastMessageAt: '2023-01-01T12:00:00Z',
        lastMessage: { text: 'Hello', direction: 'inbound' }
      }
    ],
    setSelectedConversationId: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('lucide-react-native', () => ({
  Search: 'SearchIcon',
  Bot: 'BotIcon',
  BellOff: 'BellOffIcon',
  MessageSquareOff: 'MessageSquareOffIcon',
}));

describe('InboxScreen', () => {
  it('renders the conversation list correctly', () => {
    const tree = renderer.create(<InboxScreen />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
