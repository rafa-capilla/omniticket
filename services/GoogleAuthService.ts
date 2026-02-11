
// Fix: Declare google as a global variable to satisfy TypeScript since it is loaded via script tag
declare const google: any;

// We use implicit flow for client-side only access
export class GoogleAuthService {
  private static readonly SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ].join(' ');

  private static tokenClient: any = null;

  static init(callback: (token: string) => void, clientId: string) {
    // Fix: Reference to google is now recognized after global declaration
    if (typeof google === 'undefined') {
      console.error('Google Identity Services script not loaded');
      return;
    }

    // Fix: Reference to google is now recognized after global declaration
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: this.SCOPES,
      callback: (response: any) => {
        if (response.access_token) {
          callback(response.access_token);
        }
      },
    });
  }

  static login() {
    if (this.tokenClient) {
      this.tokenClient.requestAccessToken();
    }
  }

  static logout() {
    // In implicit flow, we just clear our local state
    localStorage.removeItem('google_access_token');
  }
}
