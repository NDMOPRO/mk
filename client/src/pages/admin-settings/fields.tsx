import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createContext, useContext } from "react";

type SettingsForm = {
  settings: Record<string, string>;
  updateSetting: (key: string, value: string) => void;
  dir: string;
};

const SettingsFormContext = createContext<SettingsForm | null>(null);
export const SettingsFormProvider = SettingsFormContext.Provider;

function useSettingsForm(): SettingsForm {
  const v = useContext(SettingsFormContext);
  if (!v) throw new Error("SettingField must be inside SettingsFormProvider");
  return v;
}

export const SettingField = ({ label, settingKey, type = "text", placeholder, disabled = false }: { label: string; settingKey: string; type?: string; placeholder?: string; disabled?: boolean }) => {
  const { settings, updateSetting, dir } = useSettingsForm();
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {type === "textarea" ? (
        <Textarea
          value={settings[settingKey] || ""}
          onChange={(e) => updateSetting(settingKey, e.target.value)}
          placeholder={placeholder}
          className="min-h-[100px]"
          dir={settingKey.endsWith("Ar") ? "rtl" : settingKey.endsWith("En") ? "ltr" : dir}
          disabled={disabled}
        />
      ) : type === "color" ? (
        <div className="flex gap-3 items-center">
          <input
            type="color"
            value={settings[settingKey] || "#15803d"}
            onChange={(e) => updateSetting(settingKey, e.target.value)}
            className="w-12 h-10 rounded border cursor-pointer"
            disabled={disabled}
          />
          <Input
            value={settings[settingKey] || ""}
            onChange={(e) => updateSetting(settingKey, e.target.value)}
            placeholder="#15803d"
            className="flex-1"
            disabled={disabled}
          />
        </div>
      ) : (
        <Input
          type={type}
          value={settings[settingKey] || ""}
          onChange={(e) => updateSetting(settingKey, e.target.value)}
          placeholder={placeholder}
          dir={settingKey.endsWith("Ar") ? "rtl" : settingKey.endsWith("En") ? "ltr" : undefined}
          disabled={disabled}
        />
      )}
    </div>
  );
};

export const BilingualField = ({ labelAr, labelEn, keyAr, keyEn, type = "text" }: { labelAr: string; labelEn: string; keyAr: string; keyEn: string; type?: string }) => {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SettingField label={`${labelAr} (${t("settings.arabic")})`} settingKey={keyAr} type={type} />
      <SettingField label={`${labelEn} (${t("settings.english")})`} settingKey={keyEn} type={type} />
    </div>
  );
};
