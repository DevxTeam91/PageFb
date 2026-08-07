import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Switch, Modal, TextInput, Platform 
} from 'react-native';
import { 
  Plus, Trash2, Edit3, ArrowUp, ArrowDown, 
  Bot, Sparkles, CheckCircle2, XCircle 
} from 'lucide-react-native';
import { useGlobalState } from '../context/GlobalStateContext';
import { Rule, MatchType } from '../types';

export const RulesScreen = () => {
  const { rules, handleCreateRule, handleUpdateRule, handleDeleteRule, handleReorderRules } = useGlobalState();
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const [keyword, setKeyword] = useState('');
  const [matchType, setMatchType] = useState<MatchType>('contains');
  const [replyText, setReplyText] = useState('');
  const [priority, setPriority] = useState<number>(0);
  const [enabled, setEnabled] = useState(true);

  const [testString, setTestString] = useState('');

  const openCreateModal = () => {
    setEditingRuleId(null);
    setKeyword('');
    setMatchType('contains');
    setReplyText('');
    setPriority(rules.length);
    setEnabled(true);
    setTestString('');
    setModalOpen(true);
  };

  const openEditModal = (rule: Rule) => {
    setEditingRuleId(rule.id);
    setKeyword(rule.keyword);
    setMatchType(rule.matchType);
    setReplyText(rule.replyText);
    setPriority(rule.priority);
    setEnabled(rule.enabled);
    setTestString('');
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!keyword.trim() || !replyText.trim()) return;

    if (editingRuleId) {
      await handleUpdateRule(editingRuleId, {
        keyword: keyword.trim(),
        matchType,
        replyText: replyText.trim(),
        priority,
        enabled,
      });
    } else {
      await handleCreateRule({
        keyword: keyword.trim(),
        matchType,
        replyText: replyText.trim(),
        priority,
        enabled,
      });
    }
    setModalOpen(false);
  };

  const moveRule = async (index: number, direction: 'up' | 'down') => {
    const newRules = [...rules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newRules.length) return;

    const temp = newRules[index];
    newRules[index] = newRules[targetIndex];
    newRules[targetIndex] = temp;

    const ids = newRules.map((r) => r.id);
    await handleReorderRules(ids);
  };

  const isMatch = (() => {
    if (!keyword.trim() || !testString.trim()) return null;
    const normTest = testString.trim().toLowerCase();
    const normKey = keyword.trim().toLowerCase();

    if (matchType === 'exact') return normTest === normKey;
    if (matchType === 'contains') return normTest.includes(normKey);
    if (matchType === 'regex') {
      try {
        const r = new RegExp(keyword.trim(), 'i');
        return r.test(testString.trim());
      } catch {
        return false;
      }
    }
    return false;
  })();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerDesc}>
          Configure automated responses based on incoming user keywords and patterns.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={openCreateModal}>
          <Plus size={16} color="#1E1E1E" />
          <Text style={styles.primaryBtnText}>New Auto-Reply Rule</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.rulesList}>
        {rules.length === 0 ? (
          <View style={styles.emptyState}>
            <Bot size={48} color="#4f46e5" />
            <Text style={styles.emptyStateTitle}>No auto-reply rules defined</Text>
            <Text style={styles.emptyStateDesc}>
              Create rules to automatically respond to common questions like pricing, hours, or support.
            </Text>
            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 16 }]} onPress={openCreateModal}>
              <Plus size={16} color="#1E1E1E" />
              <Text style={styles.primaryBtnText}>Add First Rule</Text>
            </TouchableOpacity>
          </View>
        ) : (
          rules.map((rule, idx) => (
            <View key={rule.id} style={styles.ruleCard}>
              <View style={styles.ruleHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.priorityText}>#{idx + 1}</Text>
                  <View style={styles.reorderArrows}>
                    <TouchableOpacity onPress={() => moveRule(idx, 'up')} disabled={idx === 0}>
                      <ArrowUp size={16} color={idx === 0 ? '#555555' : '#9CA3AF'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveRule(idx, 'down')} disabled={idx === rules.length - 1}>
                      <ArrowDown size={16} color={idx === rules.length - 1 ? '#555555' : '#9CA3AF'} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Switch
                  value={rule.enabled}
                  onValueChange={(val) => handleUpdateRule(rule.id, { enabled: val })}
                  trackColor={{ false: '#555555', true: '#4f46e5' }}
                />
              </View>

              <View style={styles.ruleBody}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.keywordCode}>{rule.keyword}</Text>
                  <View style={styles.matchBadge}>
                    <Text style={styles.matchBadgeText}>{rule.matchType.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.replySnippet} numberOfLines={2}>{rule.replyText}</Text>
              </View>

              <View style={styles.ruleActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(rule)}>
                  <Edit3 size={16} color="#9CA3AF" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => handleDeleteRule(rule.id)}>
                  <Trash2 size={16} color="#F87171" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>{editingRuleId ? 'Edit Auto-Reply Rule' : 'Create New Auto-Reply Rule'}</Text>

              <Text style={styles.formLabel}>Keyword or Pattern</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. pricing, hours"
                value={keyword}
                onChangeText={setKeyword}
              />

              <Text style={styles.formLabel}>Match Type</Text>
              <View style={styles.matchTypeSelector}>
                {(['contains', 'exact', 'regex'] as const).map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.matchTypeBtn, matchType === type && styles.matchTypeBtnActive]}
                    onPress={() => setMatchType(type)}
                  >
                    <Text style={[styles.matchTypeBtnText, matchType === type && styles.matchTypeBtnTextActive]}>
                      {type.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Live Rule Tester */}
              <View style={styles.testerCard}>
                <View style={styles.testerHeader}>
                  <Sparkles size={14} color="#818cf8" />
                  <Text style={styles.testerTitle}>Interactive Pattern Tester</Text>
                </View>
                <TextInput
                  style={styles.testerInput}
                  placeholder="Type sample user message..."
                  placeholderTextColor="#94a3b8"
                  value={testString}
                  onChangeText={setTestString}
                />
                {testString.trim().length > 0 && (
                  <View style={styles.testerResult}>
                    {isMatch ? (
                      <>
                        <CheckCircle2 size={16} color="#4ADE80" />
                        <Text style={styles.testerResultMatch}>Matches! Rule would trigger reply.</Text>
                      </>
                    ) : (
                      <>
                        <XCircle size={16} color="#F87171" />
                        <Text style={styles.testerResultNoMatch}>Does not match.</Text>
                      </>
                    )}
                  </View>
                )}
              </View>

              <Text style={styles.formLabel}>Automated Reply Text</Text>
              <TextInput
                style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Enter response..."
                value={replyText}
                onChangeText={setReplyText}
                multiline
              />

              <View style={styles.enabledRow}>
                <Text style={styles.formLabel}>Rule Active</Text>
                <Switch
                  value={enabled}
                  onValueChange={setEnabled}
                  trackColor={{ false: '#555555', true: '#4f46e5' }}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setModalOpen(false)}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.primaryBtn, (!keyword.trim() || !replyText.trim()) && { opacity: 0.5 }]} 
                  onPress={handleSubmit}
                  disabled={!keyword.trim() || !replyText.trim()}
                >
                  <Text style={styles.primaryBtnText}>{editingRuleId ? 'Update Rule' : 'Create Rule'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    padding: 16,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerDesc: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f46e5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#1E1E1E',
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    marginRight: 8,
  },
  secondaryBtnText: {
    color: '#9CA3AF',
    fontWeight: '600',
  },
  rulesList: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginTop: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F3F4F6',
    marginTop: 16,
  },
  emptyStateDesc: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  ruleCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 12,
    padding: 16,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priorityText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
    marginRight: 12,
  },
  reorderArrows: {
    flexDirection: 'row',
    gap: 8,
  },
  ruleBody: {
    marginBottom: 12,
  },
  keywordCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#2A2A2A',
    color: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 13,
    marginRight: 8,
  },
  matchBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  matchBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4f46e5',
  },
  replySnippet: {
    fontSize: 14,
    color: '#9CA3AF',
    backgroundColor: '#121212',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  ruleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
  },
  actionBtnDanger: {
    backgroundColor: '#fef2f2',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F3F4F6',
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#555555',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#F3F4F6',
    marginBottom: 16,
  },
  matchTypeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  matchTypeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#555555',
    borderRadius: 8,
    backgroundColor: '#1E1E1E',
  },
  matchTypeBtnActive: {
    backgroundColor: '#e0e7ff',
    borderColor: '#4f46e5',
  },
  matchTypeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  matchTypeBtnTextActive: {
    color: '#4f46e5',
  },
  testerCard: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  testerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  testerTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#818cf8',
    marginLeft: 6,
  },
  testerInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#1E1E1E',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  testerResult: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  testerResultMatch: {
    color: '#34d399',
    fontWeight: '600',
    fontSize: 12,
    marginLeft: 6,
  },
  testerResultNoMatch: {
    color: '#F87171',
    fontSize: 12,
    marginLeft: 6,
  },
  enabledRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
});
