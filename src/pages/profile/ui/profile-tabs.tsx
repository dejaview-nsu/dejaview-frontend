import { useUnit } from "effector-react";
import { type Key, Tab, TabList, TabPanel, Tabs } from "react-aria-components";

import { cn } from "@/shared/lib/cn";

import { PROFILE_TEXTS } from "../config";
import { isListTab, isProfileTab, PROFILE_TABS, type ProfileTab } from "../lib";
import { $tab, tabSelected } from "../model";
import { ComingSoon } from "./coming-soon";
import { ListContent } from "./list-content";
import { SecurityPanel } from "./security-panel";

const TabContent = ({ tab }: { tab: ProfileTab }) => {
  if (isListTab(tab)) return <ListContent list={tab} />;

  if (tab === "security") return <SecurityPanel />;

  return <ComingSoon section={tab} />;
};

export const ProfileTabs = () => {
  const { tab, selectTab } = useUnit({ tab: $tab, selectTab: tabSelected });

  const handleSelectionChange = (key: Key) => {
    if (isProfileTab(key)) selectTab(key);
  };

  return (
    <Tabs selectedKey={tab} onSelectionChange={handleSelectionChange} className="flex flex-col">
      <TabList
        aria-label={PROFILE_TEXTS.tabsLabel}
        className="-mx-4 flex overflow-x-auto border-b-2 border-divider px-4 md:mx-0 md:px-0"
      >
        {PROFILE_TABS.map((id) => (
          <Tab
            key={id}
            id={id}
            className={({ isSelected }) =>
              cn(
                "relative flex min-h-11 shrink-0 cursor-pointer items-center px-4 pt-2 pb-4 font-label text-sm leading-none font-semibold tracking-widest whitespace-nowrap uppercase outline-none md:px-5 md:pb-5 md:text-[15px]",
                "data-[focus-visible]:outline-2 data-[focus-visible]:-outline-offset-2 data-[focus-visible]:outline-link",
                isSelected ? "text-ink" : "text-muted hover:text-ink",
              )
            }
          >
            {({ isSelected }) => (
              <>
                {PROFILE_TEXTS.tabs[id]}
                {isSelected && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-4 bottom-2.5 h-[3px] bg-ink md:inset-x-5 md:bottom-3"
                  />
                )}
              </>
            )}
          </Tab>
        ))}
      </TabList>

      {PROFILE_TABS.map((id) => (
        <TabPanel
          key={id}
          id={id}
          className={cn(
            "outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-4 data-[focus-visible]:outline-link",
            isListTab(id) ? "mt-6 md:mt-8" : "mt-8 md:mt-10",
          )}
        >
          <TabContent tab={id} />
        </TabPanel>
      ))}
    </Tabs>
  );
};
