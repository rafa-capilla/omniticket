
// Minimal types for Google Identity Services (loaded via script tag, no @types package)
interface TokenResponse {
  access_token?: string;
}

interface TokenClient {
  requestAccessToken(opts: { prompt: string }): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

const TOKEN_KEY = 'google_access_token';
const TOKEN_EXPIRES_KEY = 'google_token_expires_at';
// Google OAuth tokens last 1 hour; we refresh proactively at 55 min
const TOKEN_LIFETIME_MS = 60 * 60 * 1000;
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

export class GoogleAuthService {
  private static readonly SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
  ].join(' ');

  private static tokenClient: TokenClient | null = null;

  static init(callback: (token: string) => void, clientId: string) {
    if (typeof google === 'undefined') {
      console.error('Google Identity Services script not loaded');
      return;
    }

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: this.SCOPES,
      callback: (response: TokenResponse) => {
        if (response.access_token) {
          localStorage.setItem(TOKEN_KEY, response.access_token);
          localStorage.setItem(TOKEN_EXPIRES_KEY, String(Date.now() + TOKEN_LIFETIME_MS));
          callback(response.access_token);
        }
      },
    });
  }

  static login() {
    if (this.tokenClient) {
      this.tokenClient.requestAccessToken({ prompt: '' });
    }
  }

  /**
   * Intenta renovar el token sin mostrar UI al usuario.
   * Si el usuario sigue autenticado, el callback de init() recibirá el nuevo token.
   * Si falla silenciosamente, el usuario verá el error cuando haga la siguiente llamada.
   */
  static silentRefresh() {
    if (this.tokenClient) {
      this.tokenClient.requestAccessToken({ prompt: '' });
    }
  }

  /** Comprueba si el token expira en menos de REFRESH_THRESHOLD_MS */
  static isTokenExpiringSoon(): boolean {
    const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRES_KEY) || 0);
    return expiresAt > 0 && Date.now() > expiresAt - REFRESH_THRESHOLD_MS;
  }

  static logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRES_KEY);
  }
}
