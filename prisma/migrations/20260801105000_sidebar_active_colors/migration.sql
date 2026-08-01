ALTER TABLE "branding_settings"
ADD COLUMN IF NOT EXISTS "sidebar_active_bg_color" TEXT NOT NULL DEFAULT '#FFFFFF',
ADD COLUMN IF NOT EXISTS "sidebar_active_text_color" TEXT NOT NULL DEFAULT '#FFFFFF',
ADD COLUMN IF NOT EXISTS "sidebar_active_icon_color" TEXT NOT NULL DEFAULT '#FFFFFF',
ADD COLUMN IF NOT EXISTS "sidebar_font_family" TEXT NOT NULL DEFAULT 'Manrope';
