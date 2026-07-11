import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import App from './App';
import { createStarterBoard } from './data/starterBoard';
import {
  MemoryBoardStorage,
  initializeBoardStorage,
  loadBoard,
  type BoardStorageInitialization,
} from './lib/storage';
import '@xyflow/react/dist/style.css';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

root.render(
  <div className="app-loading" role="status">
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
    <span>正在打开本地画布</span>
  </div>,
);

async function bootstrap() {
  let initialized: BoardStorageInitialization;
  let persistentStorage = true;

  try {
    initialized = await initializeBoardStorage();
  } catch {
    persistentStorage = false;
    const fallbackBoard = loadBoard() ?? createStarterBoard();
    const storage = new MemoryBoardStorage();
    await storage.putBoardAndSetActive(fallbackBoard);
    initialized = {
      storage,
      activeBoard: fallbackBoard,
      boards: await storage.listBoards(),
      warning: 'IndexedDB 不可用，本次编辑仅保留在当前页面，请及时导出文件。',
    };
  }

  root.render(
    <StrictMode>
      <ReactFlowProvider>
        <App
          initialBoard={initialized.activeBoard}
          initialBoards={initialized.boards}
          storage={initialized.storage}
          persistentStorage={persistentStorage}
          initialWarning={initialized.warning}
        />
      </ReactFlowProvider>
    </StrictMode>,
  );
}

void bootstrap();
