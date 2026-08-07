import React from 'react';
import renderer from 'react-test-renderer';
import { RulesScreen } from '../RulesScreen';

// Mock dependencies
jest.mock('../../context/GlobalStateContext', () => ({
  useGlobalState: () => ({
    rules: [
      {
        id: '1',
        keyword: 'pricing',
        matchType: 'contains',
        replyText: 'Our pricing starts at $9.99.',
        priority: 1,
        enabled: true,
      }
    ],
    handleCreateRule: jest.fn(),
    handleUpdateRule: jest.fn(),
    handleDeleteRule: jest.fn(),
    handleReorderRules: jest.fn(),
  }),
}));

jest.mock('lucide-react-native', () => ({
  Plus: 'PlusIcon',
  Trash2: 'Trash2Icon',
  Edit3: 'Edit3Icon',
  ArrowUp: 'ArrowUpIcon',
  ArrowDown: 'ArrowDownIcon',
  Bot: 'BotIcon',
  Sparkles: 'SparklesIcon',
  CheckCircle2: 'CheckCircle2Icon',
  XCircle: 'XCircleIcon',
}));

describe('RulesScreen', () => {
  it('renders the active rules list correctly', () => {
    const tree = renderer.create(<RulesScreen />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
