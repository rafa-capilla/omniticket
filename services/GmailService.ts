
export class GmailService {
  constructor(private accessToken: string) {}

  async searchThreads(query: string): Promise<string[]> {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    const data = await response.json();
    return (data.threads || []).map((t: any) => t.id);
  }

  async getThreadContent(threadId: string): Promise<string> {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    const data = await response.json();
    
    // Concatenate all messages in thread to get full context
    let fullText = "";
    data.messages.forEach((msg: any) => {
      const part = msg.payload.parts ? msg.payload.parts[0] : msg.payload;
      if (part.body && part.body.data) {
        fullText += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
    });
    
    return fullText;
  }

  async addLabelToThread(threadId: string, labelName: string) {
    const labelId = await this.getOrCreateLabel(labelName);
    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        addLabelIds: [labelId]
      })
    });
  }

  private async getOrCreateLabel(name: string): Promise<string> {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    const data = await response.json();
    const existing = data.labels.find((l: any) => l.name === name);
    if (existing) return existing.id;

    const createResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
    });
    const created = await createResponse.json();
    return created.id;
  }
}
