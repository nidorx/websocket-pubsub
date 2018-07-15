import * as WebSocket from 'ws';

type Callback = (data: any, ws: WebSocket, accept: (data?: any) => void, reject: (cause: any) => void) => void;

class Actions {

   private actions: { [key: string]: Callback } = {};

   /**
    * Executa uma ação
    * 
    * @param name 
    * @param data 
    * @param ws 
    */
   exec(name: string, data: any, ws: WebSocket): Promise<any> {      
      return new Promise<any>((accept, reject) => {
         if (!this.actions.hasOwnProperty(name)) {
            return reject('Operação não cadastrada');
         }

         this.actions[name](data, ws, accept, reject);
      });
   }

   /**
    * Registra uma nova ação que pode ser executada pelo usuário
    * 
    * @param name 
    * @param callback 
    */
   register(name: string, callback: Callback) {
      this.actions[name] = callback;
   }

}

export default new Actions;