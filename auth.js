import fs from 'fs';
import https from 'https';

const TOKENS_FILE = './tokens.json';

/**
 * Carrega os tokens salvos do arquivo
 */
export function loadTokens() {
  if (fs.existsSync(TOKENS_FILE)) {
    const data = fs.readFileSync(TOKENS_FILE, 'utf8');
    return JSON.parse(data);
  }
  return null;
}

/**
 * Salva os tokens no arquivo
 */
export function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

/**
 * Faz uma requisição HTTPS e retorna uma Promise
 */
function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

/**
 * Valida se o token ainda é válido
 */
export async function validateToken(accessToken, clientId) {
  const options = {
    hostname: 'id.twitch.tv',
    path: '/oauth2/validate',
    method: 'GET',
    headers: {
      'Authorization': `OAuth ${accessToken}`
    }
  };
  
  try {
    const result = await httpsRequest(options);
    return result.client_id === clientId;
  } catch (error) {
    return false;
  }
}

/**
 * Renova o access token usando o refresh token
 */
export async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const postData = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret
  }).toString();
  
  const options = {
    hostname: 'id.twitch.tv',
    path: '/oauth2/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }
  };
  
  try {
    const result = await httpsRequest(options, postData);
    
    if (result.access_token) {
      const tokens = {
        access_token: result.access_token,
        refresh_token: result.refresh_token || refreshToken,
        expires_at: Date.now() + (result.expires_in * 1000)
      };
      
      saveTokens(tokens);
      console.log('✓ Token renovado com sucesso!');
      return tokens;
    } else {
      throw new Error('Falha ao renovar token: ' + JSON.stringify(result));
    }
  } catch (error) {
    console.error('Erro ao renovar token:', error.message);
    throw error;
  }
}

/**
 * Verifica se o token está próximo de expirar (menos de 1 hora)
 */
export function isTokenExpiringSoon() {
  const tokens = loadTokens();

  if (!tokens || !tokens.expires_at) {
    return true; // Se não tem informação de expiração, assume que deve renovar
  }

  const now = Date.now();
  const timeUntilExpiry = tokens.expires_at - now;
  const twoHoursInMs = 60 * 60 * 1000 * 2; // 2 horas

  return timeUntilExpiry < twoHoursInMs;
}

/**
 * Obtém um access token válido, renovando se necessário
 */
export async function getValidAccessToken(clientId, clientSecret) {
  let tokens = loadTokens();

  if (!tokens) {
    throw new Error('Nenhum token encontrado. Execute: npm run auth');
  }

  // Verifica se o token ainda é válido
  const isValid = await validateToken(tokens.access_token, clientId);

  if (isValid) {
    console.log('✓ Token válido');
    return tokens.access_token;
  }

  // Token expirado, renovar
  console.log('⟳ Token expirado, renovando...');
  tokens = await refreshAccessToken(tokens.refresh_token, clientId, clientSecret);
  return tokens.access_token;
}
