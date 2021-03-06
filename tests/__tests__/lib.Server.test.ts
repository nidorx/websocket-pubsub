
import http from 'http';
import express from 'express';
import Topic from '../../src/lib/Topic';
import Server from '../../src/lib/Server';
import Client from '../../src/lib/Client';
import Actions from '../../src/lib/Actions';
import Publishers from '../../src/lib/Publishers';
import ClientStorageMemory from '../../src/lib/storage/ClientStorageMemory';
import InMemoryRepository from '../../src/lib/repository/InMemoryRepository';

describe('Server', () => {

   let server: Server;

   it('Deve permitir e gerenciar a conexão e desconexão de clientes', async (done) => {

      server.use((ctx, next) => {
         next();
      }, 'connection');

      server.use((ctx, next) => {
         // Se esse ponto não for invocado, vai estourar timeout
         done();

         next();
      }, 'close');

      const client = new Client('ws://localhost:3000', new ClientStorageMemory('test'));
      // Logger.get('Client').setLevel('TRACE');
      client.connect(() => {
         // finaliza a conexao, deve chamar o 'close' do server
         client.close();
      });
   }, 3000);

   it('Após fazer o subscribe, deve receber imediatamente os dados do tópico', async (done) => {

      // Cria dados do grupo
      const clientA = new Client('ws://localhost:3000', new ClientStorageMemory('test'));
      clientA.connect(() => {
         clientA.exec('createGroup', { name: 'Grupo 1' })
            .then((id) => {

               // Finaliza a conexão do cliente
               clientA.close();

               const clientB = new Client('ws://localhost:3000', new ClientStorageMemory('test'));
               clientB.connect(() => {
                  clientB.subscribe('groups', (groups) => {

                     // Finaliza a conexão do cliente
                     clientB.close();

                     // Se esse ponto não for invocado, vai estourar timeout 
                     done();
                  })
               });
            });
      });
   }, 3000);

   afterEach(async (done) => {
      server.close((err) => {
         done(err);
      });
   });

   /**
    * Inicializa o servidor e os parametros testáveis
    */
   beforeEach(async (done) => {
      const app = express();
      const httpServer = http.createServer(app);

      const DB_TOPICS = new InMemoryRepository();
      const DB_GROUPS = new InMemoryRepository();
      const DB_USERS = new InMemoryRepository();

      // Configura o storage dos topicos
      Topic.setStorage(DB_TOPICS);

      //-------------------------------------------------------------
      // Publishers
      //-------------------------------------------------------------
      Publishers.create({
         topic: 'groups',
         idRequired: false,
         query: [
            {
               repository: DB_GROUPS,
               singleResult: false,
               params: {},
            }
         ]
      });

      Publishers.create({
         topic: 'groupById',
         idRequired: true,
         query: [
            {
               repository: DB_GROUPS,
               singleResult: true,
               params: { _id: '$id' },
            }
         ]
      });

      // Usuarios por grupo
      Publishers.create({
         topic: 'users',
         idRequired: true,
         query: [
            {
               repository: DB_USERS,
               singleResult: false,
               params: { groupId: '$id' },
            }
         ]
      });

      Publishers.create({
         topic: 'userById',
         idRequired: true,
         query: [
            {
               repository: DB_USERS,
               singleResult: true,
               params: { _id: '$id' },
            }
         ]
      });

      //-------------------------------------------------------------
      // Actions (CRUD)
      //-------------------------------------------------------------
      Actions.register('createGroup', (data: any, ws, accept, reject) => {
         DB_GROUPS.insert(data)
            .then((row) => {

               accept(row._id);

               Publishers.publish('groups');
            })
            .catch(reject);
      });

      Actions.register('updateGroup', (data: any, ws, accept, reject) => {
         DB_GROUPS.update({ _id: data._id }, { $set: data }, {})
            .then((updated) => {

               accept();

               Publishers.publish('groups');
               Publishers.publish('groupById', data._id);
            })
            .catch(reject);
      });

      Actions.register('deleteGroup', (data: any, ws, accept, reject) => {
         DB_GROUPS.remove({ _id: data._id }, {})
            .then((removed) => {

               accept();

               Publishers.publish('groups');
               Publishers.publish('groupById', data._id);
            })
            .catch(reject);
      });

      Actions.register('createUser', (data: any, ws, accept, reject) => {
         DB_USERS.insert(data)
            .then((row) => {

               accept(row._id);

               Publishers.publish('users', data.groupId);
            })
            .catch(reject);
      });

      Actions.register('updateUser', (data: any, ws, accept, reject) => {
         DB_USERS.update({ _id: data._id }, { $set: data }, {})
            .then((updated) => {

               accept();

               Publishers.publish('users', data.groupId);
               Publishers.publish('userById', data._id);
            })
            .catch(reject);
      });

      Actions.register('deleteUser', (data: any, ws, accept, reject) => {
         DB_USERS.remove({ _id: data._id }, {})
            .then((removed) => {

               accept();

               Publishers.publish('groups');
               Publishers.publish('groupById', data._id);
            })
            .catch(reject);
      });

      //initialize the PubSub server instance
      server = new Server(httpServer);

      //start our server
      httpServer.listen(3000, () => {
         done();
      });
   });
});