import OBSWebSocket from 'obs-websocket-js';

export class OBSController {
  constructor(host, port, password) {
    this.obs = new OBSWebSocket();
    this.host = host;
    this.port = port;
    this.password = password;
    this.connected = false;
  }

  /**
   * Conecta ao OBS WebSocket
   */
  async connect() {
    try {
      await this.obs.connect(`ws://${this.host}:${this.port}`, this.password);
      this.connected = true;
      console.log('✓ Conectado ao OBS WebSocket');
      return true;
    } catch (error) {
      console.error('❌ Erro ao conectar ao OBS:', error.message);
      this.connected = false;
      return false;
    }
  }

  /**
   * Verifica se está conectado
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Inicia o streaming
   */
  async startStreaming() {
    if (!this.connected) {
      throw new Error('Não conectado ao OBS');
    }

    try {
      const status = await this.obs.call('GetStreamStatus');
      
      if (status.outputActive) {
        console.log('⚠ Stream já está ativa');
        return false;
      }

      await this.obs.call('StartStream');
      console.log('✓ Stream iniciada com sucesso!');
      return true;
    } catch (error) {
      console.error('❌ Erro ao iniciar stream:', error.message);
      throw error;
    }
  }

  /**
   * Para o streaming
   */
  async stopStreaming() {
    if (!this.connected) {
      throw new Error('Não conectado ao OBS');
    }

    try {
      const status = await this.obs.call('GetStreamStatus');
      
      if (!status.outputActive) {
        console.log('⚠ Stream já está parada');
        return false;
      }

      await this.obs.call('StopStream');
      console.log('✓ Stream parada com sucesso!');
      return true;
    } catch (error) {
      console.error('❌ Erro ao parar stream:', error.message);
      throw error;
    }
  }

  /**
   * Muda para uma cena específica
   */
  async switchToScene(sceneName) {
    if (!this.connected) {
      throw new Error('Não conectado ao OBS');
    }

    try {
      await this.obs.call('SetCurrentProgramScene', {
        sceneName: sceneName
      });
      console.log(`✓ Mudou para cena: ${sceneName}`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao mudar para cena ${sceneName}:`, error.message);
      throw error;
    }
  }

  /**
   * Lista todas as cenas disponíveis
   */
  async listScenes() {
    if (!this.connected) {
      throw new Error('Não conectado ao OBS');
    }

    try {
      const { scenes } = await this.obs.call('GetSceneList');
      return scenes.map(scene => scene.sceneName);
    } catch (error) {
      console.error('❌ Erro ao listar cenas:', error.message);
      throw error;
    }
  }

  /**
   * Obtém o status da stream
   */
  async getStreamStatus() {
    if (!this.connected) {
      throw new Error('Não conectado ao OBS');
    }

    try {
      const status = await this.obs.call('GetStreamStatus');
      return {
        active: status.outputActive,
        reconnecting: status.outputReconnecting,
        timecode: status.outputTimecode,
        duration: status.outputDuration,
        bytes: status.outputBytes
      };
    } catch (error) {
      console.error('❌ Erro ao obter status da stream:', error.message);
      throw error;
    }
  }

  /**
   * Desconecta do OBS
   */
  async disconnect() {
    if (this.connected) {
      await this.obs.disconnect();
      this.connected = false;
      console.log('✓ Desconectado do OBS');
    }
  }
}
