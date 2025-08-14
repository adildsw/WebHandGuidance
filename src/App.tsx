import { HashRouter, Route, Routes } from 'react-router-dom';
import Calibration from './pages/Calibration';
import { ConfigProvider } from './utils/context';
import TaskCreator from './pages/TaskCreator';
import ParallaxBackground from './pages/ParallaxBackground';
import Config from './pages/Config';
import Home from './pages/Home';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faChevronLeft, faChevronRight, faFile, faFolderOpen, faHome, faPencil, faPlus, faRedo, faSave, faTrash } from '@fortawesome/free-solid-svg-icons';

library.add(faHome, faSave, faFile, faChevronLeft, faChevronRight, faPlus, faTrash, faRedo, faFolderOpen);

const App = () => {
  return (
    <>
      <ParallaxBackground strength={0.5} />
      <ConfigProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/calibration" element={<Calibration />} />
            <Route path="/config" element={<Config />} />
            <Route path="/task-maker" element={<TaskCreator />} />
          </Routes>
        </HashRouter>
      </ConfigProvider>
    </>
  );
};

export default App;
