import { RouterProvider } from "@effector/router-react";
import { I18nProvider } from "@react-aria/i18n";

import { Routing } from "@/pages";

import { router } from "@/shared/routes";

import "./index.css";

export const App = () => {
  return (
    <I18nProvider locale="ru-RU">
      <RouterProvider router={router}>
        <Routing />
      </RouterProvider>
    </I18nProvider>
  );
};
