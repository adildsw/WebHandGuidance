import { HashRouter, Route, Routes } from 'react-router-dom';
import ScreenCalibration from './pages/ScreenCalibration';
import { ConfigProvider } from './utils/context';
import Config from './pages/Config';
import Home from './pages/Home';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowRight,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
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
import useWebSerial from './hooks/useWebSerial';
import NoMobileSupport from './pages/NoMobileSupport';
import { useEffect, useState } from 'react';
import RomCalibration from './pages/RomCalibration';
import useBle from './hooks/useBle';
import MediaPlayer from './components/MediaPlayer';
import TaskDesigner from './pages/TaskDesigner/TaskDesigner';
import SilhouetteVisualizer from './pages/SilhouetteVisualizer';

library.add(faCheck, faArrowRight, faChevronUp, faChevronDown, faLink, faHome, faSave, faFile, faChevronLeft, faChevronRight, faPlus, faTrash, faRedo, faFolderOpen, faDownload, faUpRightAndDownLeftFromCenter);

const App = () => {
  const webSerial = useWebSerial({ baudRate: 115200 });
  const ble = useBle();
  const [isMobile, setIsMobileMode] = useState<boolean>(/Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 768 || window.innerWidth < window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileMode(/Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 768 || window.innerWidth < window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (isMobile) return <NoMobileSupport />;

  return (
    <>
      <ConfigProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/study" element={<Study webSerial={webSerial} ble={ble} />} />
            <Route path="/screen-calibration" element={<ScreenCalibration />} />
            <Route path="/camera-calibration" element={<CameraCalibration />} />
            <Route path="/rom-calibration" element={<RomCalibration />} />
            <Route path="/config" element={<Config />} />
            <Route path="/create-study-tasks" element={<TaskDesigner />} />
            <Route path="/visualizer" element={<SilhouetteVisualizer />} />
            
            <Route path="/videotest" element={<MediaPlayer mediaUrl='https://webhandguidance.b-cdn.net/rom_calibration_demo_test.mp4' mediaTitle='Test Video' mediaSubtitle='This is a test video' doneBtnTitle='Begin Calibration' />} />
            <Route path="imgtest" element={<MediaPlayer mediaUrl='https://webhandguidance.b-cdn.net/first_message_image_test.png' mediaTitle='Test Image' mediaSubtitle='This is a test image' />} />
          </Routes>
        </HashRouter>
      </ConfigProvider>

      <Toaster />
      
      <SerialConnector webSerial={webSerial} ble={ble} />
    </>
  );
};

export default App;
