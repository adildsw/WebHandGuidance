import { HashRouter, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Calibration from './pages/Calibration';
import Config from './pages/Config';
import { ConfigProvider } from './utils/context';
import TaskCreator from './pages/TaskCreator';

const App = () => {
  return (
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
  );
};

export default App;
