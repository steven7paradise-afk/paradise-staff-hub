ALTER TABLE "branding_settings"
ADD COLUMN "sidebar_text_color" TEXT NOT NULL DEFAULT '#1F1F1F',
ADD COLUMN "sidebar_icon_color" TEXT NOT NULL DEFAULT '#1F1F1F',
ADD COLUMN "dark_sidebar_text_color" TEXT NOT NULL DEFAULT '#F8F3F6',
ADD COLUMN "dark_sidebar_icon_color" TEXT NOT NULL DEFAULT '#F8F3F6';
