import type { ChatMessage } from '../../shared/types/llm.js';

export class InMemoryChatHistoryStore {
  private readonly historyByUser = new Map<string, ChatMessage[]>();

  constructor(private readonly maxMessages = 20) {}

  get(userId: string): ChatMessage[] {
    return this.historyByUser.get(userId) ?? [];
  }

  add(userId: string, message: ChatMessage): void {
    const history = this.historyByUser.get(userId) ?? [];
    const updated = [...history, message].slice(-this.maxMessages);
    this.historyByUser.set(userId, updated);
  }

  clear(userId: string): void {
    this.historyByUser.delete(userId);
  }
}
