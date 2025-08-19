import { HashRouter, Route, Routes } from 'react-router-dom';
import ScreenCalibration from './pages/ScreenCalibration';
import { ConfigProvider } from './utils/context';
import TaskCreator from './pages/TaskCreator';
import ParallaxBackground from './extras/ParallaxBackground';
import Config from './pages/Config';
import Home from './pages/Home';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faChevronLeft, faChevronRight, faFile, faFolderOpen, faHome, faPencil, faPlus, faRedo, faSave, faTrash } from '@fortawesome/free-solid-svg-icons';
import Study from './pages/Study';
import CameraCalibration from './pages/CameraCalibration';

library.add(faHome, faSave, faFile, faChevronLeft, faChevronRight, faPlus, faTrash, faRedo, faFolderOpen);

const App = () => {
  return (
    <>
      <ParallaxBackground strength={0.5} />
      <ConfigProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/study" element={<Study />} />
            <Route path="/screen-calibration" element={<ScreenCalibration />} />
            <Route path="/camera-calibration" element={<CameraCalibration />} />
            <Route path="/config" element={<Config />} />
            <Route path="/create-study-tasks" element={<TaskCreator />} />
          </Routes>
        </HashRouter>
      </ConfigProvider>
    </>
  );
};

export default App;
