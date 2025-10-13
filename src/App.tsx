import { HashRouter, Route, Routes } from 'react-router-dom';
import ScreenCalibration from './pages/ScreenCalibration';
import { ConfigProvider } from './utils/context';
import TaskCreator from './pages/TaskCreator';
import Config from './pages/Config';
import Home from './pages/Home';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faChevronLeft,
  faChevronRight,
  faDownload,
  faFile,
  faFolderOpen,
  faHome,
  faLink,
  faPlus,
  faRedo,
  faSave,
  faTrash,
  faUpRightAndDownLeftFromCenter,
} from '@fortawesome/free-solid-svg-icons';
import Study from './pages/Study';
import CameraCalibration from './pages/CameraCalibration';
import { Toaster } from 'react-hot-toast';
import SerialConnector from './components/SerialConnector';
import { useWebSerial } from './hooks/useWebSerial';

library.add(faLink, faHome, faSave, faFile, faChevronLeft, faChevronRight, faPlus, faTrash, faRedo, faFolderOpen, faDownload, faUpRightAndDownLeftFromCenter);

const App = () => {
  const webSerial = useWebSerial({ baudRate: 115200 });

  return (
    <>
      <ConfigProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/study" element={<Study webSerial={webSerial} />} />
            <Route path="/screen-calibration" element={<ScreenCalibration />} />
            <Route path="/camera-calibration" element={<CameraCalibration />} />
            <Route path="/config" element={<Config />} />
            <Route path="/create-study-tasks" element={<TaskCreator />} />
          </Routes>
        </HashRouter>
      </ConfigProvider>

      <Toaster />

      <SerialConnector webSerial={webSerial} />
    </>
  );
};

export default App;
