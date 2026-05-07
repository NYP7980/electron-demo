# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

## Game Room Cloud Server Config

The game room client connects through [src/hooks/useGameSocket.ts](/D:/codeHub/myProject/my-electron/src/hooks/useGameSocket.ts), and the WebSocket server lives in [server/src/index.ts](/D:/codeHub/myProject/my-electron/server/src/index.ts).

Use these config files when moving the game room to a cloud server:

1. Local frontend config: copy [.env.development.example](/D:/codeHub/myProject/my-electron/.env.development.example) to `.env.development`
2. Production frontend config: copy [.env.production.example](/D:/codeHub/myProject/my-electron/.env.production.example) to `.env.production`
3. Server config: copy [server/.env.example](/D:/codeHub/myProject/my-electron/server/.env.example) to `server/.env`

Suggested values:

- local: `REACT_APP_WS_URL=ws://localhost:4000`
- cloud: `REACT_APP_WS_URL=wss://your-domain.example.com/ws`
- server: `HOST=0.0.0.0` and `PORT=4000`

For Electron builds, you can also inject `GAME_SERVER_URL` at runtime. The app now resolves the game server address in this order:

1. `GAME_SERVER_URL`
2. `REACT_APP_WS_URL`
3. `ws://localhost:4000`

Typical production topology:

- Node WebSocket server listens on `0.0.0.0:4000`
- Nginx or another reverse proxy exposes `wss://your-domain.example.com/ws`
- Frontend connects to that `wss://` address
