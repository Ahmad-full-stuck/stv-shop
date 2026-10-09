-- رفع الفيديو: حقل واحد لكل منتج (مسار نسبي مثل videos/<slug>.mp4)
ALTER TABLE products ADD COLUMN video TEXT;
