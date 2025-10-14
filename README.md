# Bot Twitch para Controle Remoto de OBS

Bot da Twitch que permite ao broadcaster controlar remotamente o OBS Studio via WebSocket para iniciar e parar streams de IRL.

## Características

- Controle remoto do OBS via chat da Twitch
- Autenticação OAuth com renovação automática de tokens
- Comandos restritos ao broadcaster
- Conexão via WebSocket com o OBS
- Troca automática de cena ao iniciar stream

## Requisitos

- Node.js 16 ou superior
- OBS Studio com obs-websocket plugin (incluído no OBS 28+)
- Conta na Twitch

## Instalação

### 1. Clone ou baixe este repositório

```bash
git clone <url-do-repositorio>
cd BotStartStream
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o OBS WebSocket

1. Abra o OBS Studio
2. Vá em **Ferramentas** > **obs-websocket Settings**
3. Habilite o WebSocket Server
4. Configure uma senha (você vai precisar dela no .env)
5. Anote a porta (padrão: 4455)

### 4. Crie uma aplicação na Twitch

1. Acesse https://dev.twitch.tv/console/apps
2. Clique em "Register Your Application"
3. Preencha:
   - **Name**: Nome do seu bot (ex: "Meu Bot OBS")
   - **OAuth Redirect URLs**: `http://localhost:3000/callback`
   - **Category**: Chat Bot
4. Clique em "Create"
5. Anote o **Client ID**
6. Clique em "New Secret" e anote o **Client Secret**

### 5. Configure o arquivo .env

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas informações:

```env
# Twitch OAuth Configuration
TWITCH_CLIENT_ID=seu_client_id_aqui
TWITCH_CLIENT_SECRET=seu_client_secret_aqui
TWITCH_REDIRECT_URI=http://localhost:3000/callback

# Twitch Channel
TWITCH_CHANNEL=seu_canal_aqui

# OBS WebSocket Configuration
OBS_HOST=localhost
OBS_PORT=4455
OBS_PASSWORD=sua_senha_do_obs_aqui

# Nome da cena de intro no OBS
INTRO_SCENE_NAME=Intro

# Comandos do bot (sem o prefixo !)
START_COMMAND=startirl
STOP_COMMAND=stopirl
```

### 6. Autentique o bot

Execute o script de autenticação:

```bash
npm run auth
```

Isso abrirá um servidor local na porta 3000. Abra seu navegador em `http://localhost:3000` e autorize o bot.

### 7. Inicie o bot

```bash
npm start
```

## Uso

### Comandos disponíveis

Apenas o **broadcaster** pode usar estes comandos:

- **!startirl** - Inicia a stream IRL
  - Muda para a cena de intro
  - Inicia o streaming no OBS

- **!stopirl** - Para a stream IRL
  - Para o streaming no OBS

### Personalização

Você pode personalizar os comandos editando o arquivo `.env`:

```env
# Exemplo: mudar comandos para !go e !stop
START_COMMAND=go
STOP_COMMAND=stop
```

## Acesso Remoto

Para controlar o OBS de um PC diferente:

1. No PC com o OBS, configure o OBS WebSocket para aceitar conexões externas
2. No arquivo `.env` do bot, configure:
   ```env
   OBS_HOST=ip.do.pc.com.obs
   OBS_PORT=4455
   ```
3. Certifique-se de que a porta 4455 está aberta no firewall

## Renovação Automática de Tokens

O bot renova automaticamente os tokens OAuth da Twitch quando eles expiram. Você não precisa fazer nada manualmente.

## Estrutura do Projeto

```
BotStartStream/
├── auth.js           # Módulo de autenticação OAuth
├── auth-setup.js     # Script de setup inicial
├── obs.js            # Controlador do OBS WebSocket
├── index.js          # Arquivo principal do bot
├── package.json      # Configuração do projeto
├── .env              # Configurações (não commitar)
├── .env.example      # Exemplo de configurações
├── tokens.json       # Tokens salvos (gerado automaticamente)
└── README.md         # Este arquivo
```

## Solução de Problemas

### Bot não conecta ao OBS

- Verifique se o OBS está aberto
- Verifique se o WebSocket está habilitado no OBS
- Verifique se a senha no `.env` está correta
- Verifique se a porta está correta (padrão: 4455)

### Bot não conecta ao chat da Twitch

- Execute `npm run auth` novamente para obter novos tokens
- Verifique se o TWITCH_CHANNEL no `.env` está correto (sem #)
- Verifique se o Client ID e Secret estão corretos

### Cena não encontrada

- Certifique-se de que a cena especificada em `INTRO_SCENE_NAME` existe no OBS
- O nome da cena deve ser exato (case-sensitive)

### Token expirado

O bot renova automaticamente os tokens. Se houver erro:
1. Delete o arquivo `tokens.json`
2. Execute `npm run auth` novamente

## Segurança

- **NUNCA** compartilhe seu arquivo `.env`
- **NUNCA** commite `tokens.json` no Git
- O `.gitignore` já está configurado para ignorar estes arquivos

## Licença

ISC
