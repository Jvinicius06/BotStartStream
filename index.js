import tmi from 'tmi.js';
import dotenv from 'dotenv';
import { getValidAccessToken, isTokenExpiringSoon, refreshAccessToken, loadTokens } from './auth.js';
import { OBSController } from './obs.js';

dotenv.config();

// Configurações
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL;
const OBS_HOST = process.env.OBS_HOST || 'localhost';
const OBS_PORT = process.env.OBS_PORT || 4455;
const OBS_PASSWORD = process.env.OBS_PASSWORD;
const INTRO_SCENE_NAME = process.env.INTRO_SCENE_NAME || 'Intro';
const START_COMMAND = process.env.START_COMMAND || 'startirl';
const STOP_COMMAND = process.env.STOP_COMMAND || 'stopirl';

// Validação
if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !TWITCH_CHANNEL) {
  console.error('❌ Erro: Certifique-se de que TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET e TWITCH_CHANNEL estão definidos no .env');
  process.exit(1);
}

if (!OBS_PASSWORD) {
  console.error('❌ Erro: OBS_PASSWORD deve estar definido no .env');
  process.exit(1);
}

// Controlador do OBS
const obsController = new OBSController(OBS_HOST, OBS_PORT, OBS_PASSWORD);

// Cliente TMI (será inicializado após obter token)
let client = null;

// Timer para verificação de token
let tokenCheckInterval = null;

/**
 * Verifica e renova o token se necessário, reconectando o cliente
 */
async function checkAndRenewToken() {
  try {
    if (isTokenExpiringSoon()) {
      console.log('\n⟳ Token próximo de expirar, renovando...');

      // Renova o token
      const currentTokens = loadTokens();
      const tokens = await refreshAccessToken(
        currentTokens.refresh_token,
        TWITCH_CLIENT_ID,
        TWITCH_CLIENT_SECRET
      );

      if (client) {
        console.log('🔄 Reconectando ao chat com novo token...');

        // Desconecta o cliente atual
        await client.disconnect();

        // Recria o cliente com o novo token
        client = new tmi.Client({
          options: { debug: false },
          connection: {
            reconnect: true,
            secure: true
          },
          identity: {
            username: TWITCH_CHANNEL,
            password: `oauth:${tokens.access_token}`
          },
          channels: [TWITCH_CHANNEL]
        });

        // Re-adiciona os event handlers
        client.on('connected', onConnectedHandler);
        client.on('message', onMessageHandler);
        client.on('disconnected', onDisconnectedHandler);
        client.on('notice', onNoticeHandler);

        // Reconecta
        await client.connect();
        console.log('✓ Reconectado com sucesso!\n');
      }
    }
  } catch (error) {
    console.error('❌ Erro ao renovar token:', error.message);
  }
}

/**
 * Inicia a verificação periódica do token (a cada 30 minutos)
 */
function startTokenChecker() {
  // Verifica a cada 30 minutos
  const checkIntervalMs = 30 * 60 * 1000;

  tokenCheckInterval = setInterval(checkAndRenewToken, checkIntervalMs);
  console.log('⏱  Verificação automática de token iniciada (a cada 30 minutos)\n');
}

/**
 * Inicializa o bot
 */
async function initBot() {
  console.log('🤖 Iniciando bot da Twitch...\n');

  try {
    // Obtém token válido (renova automaticamente se expirado)
    console.log('🔑 Validando token de autenticação...');
    const accessToken = await getValidAccessToken(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);
    
    // Conecta ao OBS
    console.log('\n🎬 Conectando ao OBS WebSocket...');
    const obsConnected = await obsController.connect();
    
    if (!obsConnected) {
      console.error('❌ Não foi possível conectar ao OBS. Verifique se:');
      console.error('   1. O OBS está aberto');
      console.error('   2. O WebSocket está habilitado (Ferramentas > obs-websocket Settings)');
      console.error('   3. A senha no .env está correta');
      process.exit(1);
    }

    // Lista cenas disponíveis
    const scenes = await obsController.listScenes();
    console.log(`\n📹 Cenas disponíveis no OBS: ${scenes.join(', ')}`);
    
    if (!scenes.includes(INTRO_SCENE_NAME)) {
      console.warn(`⚠ Aviso: Cena "${INTRO_SCENE_NAME}" não encontrada. Certifique-se de criar essa cena no OBS.`);
    }

    // Configura cliente Twitch
    client = new tmi.Client({
      options: { debug: false },
      connection: {
        reconnect: true,
        secure: true
      },
      identity: {
        username: TWITCH_CHANNEL,
        password: `oauth:${accessToken}`
      },
      channels: [TWITCH_CHANNEL]
    });

    // Event handlers
    client.on('connected', onConnectedHandler);
    client.on('message', onMessageHandler);
    client.on('disconnected', onDisconnectedHandler);
    client.on('notice', onNoticeHandler);

    // Conecta ao chat
    console.log('\n💬 Conectando ao chat da Twitch...');
    await client.connect();

    // Inicia verificação periódica de token
    startTokenChecker();

  } catch (error) {
    console.error('❌ Erro ao inicializar bot:', error.message);
    process.exit(1);
  }
}

/**
 * Handler quando conecta ao chat
 */
function onConnectedHandler(addr, port) {
  console.log(`✓ Conectado ao chat: ${addr}:${port}`);
  console.log(`\n✓ Bot pronto! Comandos disponíveis:`);
  console.log(`   !${START_COMMAND} - Inicia a stream IRL (só broadcaster)`);
  console.log(`   !${STOP_COMMAND} - Para a stream IRL (só broadcaster)\n`);
}

/**
 * Handler quando desconecta do chat
 */
function onDisconnectedHandler(reason) {
  console.log(`❌ Desconectado do chat: ${reason}`);
}

/**
 * Handler para notificações (incluindo erros de autenticação)
 */
async function onNoticeHandler(channel, msgid, message) {
  // Verifica se é erro de autenticação
  if (msgid === 'msg_channel_suspended' || msgid === 'msg_banned' || msgid === 'authentication_failed') {
    console.log(`\n⚠ Erro de autenticação detectado: ${message}`);
    console.log('🔄 Tentando renovar token e reconectar...');

    try {
      await checkAndRenewToken();
    } catch (error) {
      console.error('❌ Falha ao renovar token:', error.message);
      console.error('⚠ Execute: npm run auth');
      process.exit(1);
    }
  }
}

/**
 * Handler de mensagens
 */
async function onMessageHandler(channel, tags, message, self) {
  if (self) return; // Ignora mensagens do próprio bot

  // Remove espaços em branco
  const msg = message.trim();

  // Verifica se é um comando
  if (!msg.startsWith('!')) return;

  // Remove o ! e divide o comando
  const [command, ...args] = msg.slice(1).split(' ');
  const commandLower = command.toLowerCase();

  // Verifica se é o broadcaster
  const isBroadcaster = tags.badges?.broadcaster === '1';
  
  if (!isBroadcaster) {
    console.log(`⚠ Usuário ${tags.username} tentou usar comando, mas não é o broadcaster`);
    return;
  }

  console.log(`\n📩 Comando recebido de ${tags.username}: !${command}`);

  // Processa comandos
  try {
    if (commandLower === START_COMMAND.toLowerCase()) {
      await handleStartCommand(channel, tags.username);
    } else if (commandLower === STOP_COMMAND.toLowerCase()) {
      await handleStopCommand(channel, tags.username);
    }
  } catch (error) {
    console.error(`❌ Erro ao processar comando:`, error.message);
    await client.say(channel, `@${tags.username} Erro ao executar comando: ${error.message}`);
  }
}

/**
 * Handler do comando de start
 */
async function handleStartCommand(channel, username) {
  console.log('🚀 Executando comando de start...');
  
  try {
    // Verifica se já está streaming
    const status = await obsController.getStreamStatus();
    if (status.active) {
      console.log('⚠ Stream já está ativa');
      await client.say(channel, `@${username} A stream IRL já está ativa!`);
      return;
    }

    // Muda para cena de intro
    console.log(`🎬 Mudando para cena: ${INTRO_SCENE_NAME}`);
    await obsController.switchToScene(INTRO_SCENE_NAME);
    
    // Aguarda 1 segundo para a cena carregar
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Inicia stream
    console.log('📡 Iniciando stream...');
    await obsController.startStreaming();
    
    await client.say(channel, `@${username} Stream IRL iniciada com sucesso! 🎥`);
    console.log('✓ Comando de start executado com sucesso\n');
  } catch (error) {
    console.error('❌ Erro no comando start:', error.message);
    throw error;
  }
}

/**
 * Handler do comando de stop
 */
async function handleStopCommand(channel, username) {
  console.log('🛑 Executando comando de stop...');
  
  try {
    // Verifica se está streaming
    const status = await obsController.getStreamStatus();
    if (!status.active) {
      console.log('⚠ Stream já está parada');
      await client.say(channel, `@${username} A stream IRL já está parada!`);
      return;
    }

    // Para stream
    console.log('📡 Parando stream...');
    await obsController.stopStreaming();
    
    await client.say(channel, `@${username} Stream IRL parada com sucesso! 👋`);
    console.log('✓ Comando de stop executado com sucesso\n');
  } catch (error) {
    console.error('❌ Erro no comando stop:', error.message);
    throw error;
  }
}

// Handlers de encerramento gracioso
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Encerrando bot...');

  if (tokenCheckInterval) {
    clearInterval(tokenCheckInterval);
  }

  if (client) {
    await client.disconnect();
  }

  await obsController.disconnect();

  console.log('✓ Bot encerrado\n');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n🛑 Encerrando bot...');

  if (tokenCheckInterval) {
    clearInterval(tokenCheckInterval);
  }

  if (client) {
    await client.disconnect();
  }

  await obsController.disconnect();

  console.log('✓ Bot encerrado\n');
  process.exit(0);
});

// Inicia o bot
initBot();
