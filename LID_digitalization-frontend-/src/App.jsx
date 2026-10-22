import React from 'react';
import AppRoutes from './routes';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import { ProConfigProvider, enUSIntl } from '@ant-design/pro-components';

import dayjs from 'dayjs';
import 'dayjs/locale/en';

dayjs.locale('en');

function App() {
  return (
    <ConfigProvider locale={enUS}>
      <ProConfigProvider intl={enUSIntl}>
        <AppRoutes />
      </ProConfigProvider>
    </ConfigProvider>
  );
}

export default App;
