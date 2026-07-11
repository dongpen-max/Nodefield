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

const WORKSPACE_WRITER_LOCK = 'nodefield-workspace-writer-v1';
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

function showWorkspaceWaiting() {
  root.render(
    <div className="app-loading app-loading--waiting" role="status">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="app-loading__copy">
        <strong>Nodefield 已在另一个标签页运行</strong>
        <span>关闭那个标签页后，此处会自动打开。</span>
      </span>
    </div>,
  );
}

function showUnsupportedBrowser() {
  root.render(
    <div className="app-loading app-loading--waiting" role="alert">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="app-loading__copy">
        <strong>当前浏览器无法安全打开 Nodefield</strong>
        <span>请使用支持 Web Locks 的现代浏览器。</span>
      </span>
    </div>,
  );
}

async function acquireWorkspaceWriter(): Promise<boolean> {
  const locks = navigator.locks;
  if (!locks) return false;

  try {
    await new Promise<void>((resolve, reject) => {
      void locks
        .request(WORKSPACE_WRITER_LOCK, { mode: 'exclusive' }, async () => {
          resolve();
          await new Promise<void>((release) => {
            window.addEventListener('pagehide', () => release(), { once: true });
          });
        })
        .catch(reject);
    });
    return true;
  } catch {
    return false;
  }
}

async function bootstrap() {
  const waitingTimer = window.setTimeout(showWorkspaceWaiting, 300);
  const hasWriterLock = await acquireWorkspaceWriter();
  window.clearTimeout(waitingTimer);
  if (!hasWriterLock) {
    showUnsupportedBrowser();
    return;
  }

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
      lastBackupAt: null,
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
          initialLastBackupAt={initialized.lastBackupAt}
          initialWarning={initialized.warning}
        />
      </ReactFlowProvider>
    </StrictMode>,
  );
}

window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload();
});

void bootstrap();
