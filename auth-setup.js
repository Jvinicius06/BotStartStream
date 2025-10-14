import express from 'express';
import https from 'https';
import dotenv from 'dotenv';
import { saveTokens } from './auth.js';

dotenv.config();

const app = express();
const PORT = 3000;

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const REDIRECT_URI = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Erro: TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET devem estar definidos no arquivo .env');
  process.exit(1);
}

/**
 * Faz requisição HTTPS
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
 * Troca o código de autorização por tokens
 */
async function exchangeCodeForToken(code) {
  const postData = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI
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
  
  return await httpsRequest(options, postData);
}

// Rota inicial
app.get('/', (req, res) => {
  const scopes = 'chat:read chat:edit';
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Twitch Bot - Setup OAuth</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: 50px auto;
          padding: 20px;
          background-color: #0e0e10;
          color: #efeff1;
        }
        h1 { color: #9147ff; }
        .button {
          display: inline-block;
          padding: 15px 30px;
          background-color: #9147ff;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          margin-top: 20px;
        }
        .button:hover {
          background-color: #772ce8;
        }
      </style>
    </head>
    <body>
      <h1>Twitch Bot - Configuração OAuth</h1>
      <p>Clique no botão abaixo para autorizar o bot a acessar o chat da Twitch.</p>
      <a href="${authUrl}" class="button">Autorizar Bot na Twitch</a>
    </body>
    </html>
  `);
});

// Rota de callback
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Erro</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background-color: #0e0e10;
            color: #efeff1;
          }
          h1 { color: #ff0000; }
        </style>
      </head>
      <body>
        <h1>❌ Erro</h1>
        <p>Código de autorização não recebido.</p>
      </body>
      </html>
    `);
    return;
  }
  
  try {
    const tokenData = await exchangeCodeForToken(code);
    
    if (tokenData.access_token) {
      const tokens = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Date.now() + (tokenData.expires_in * 1000)
      };
      
      saveTokens(tokens);
      
      console.log('✓ Tokens salvos com sucesso!');
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Sucesso</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background-color: #0e0e10;
              color: #efeff1;
            }
            h1 { color: #00ff00; }
          </style>
        </head>
        <body>
          <h1>✓ Autenticação bem-sucedida!</h1>
          <p>Os tokens foram salvos. Você pode fechar esta janela e iniciar o bot com: <code>npm start</code></p>
        </body>
        </html>
      `);
      
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    } else {
      throw new Error('Token não recebido');
    }
  } catch (error) {
    console.error('Erro ao obter tokens:', error);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Erro</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background-color: #0e0e10;
            color: #efeff1;
          }
          h1 { color: #ff0000; }
        </style>
      </head>
      <body>
        <h1>❌ Erro ao obter tokens</h1>
        <p>${error.message}</p>
      </body>
      </html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`\n🔧 Servidor de autenticação iniciado!`);
  console.log(`\n📝 Abra seu navegador em: http://localhost:${PORT}`);
  console.log(`\nAguardando autorização...\n`);
});
