---
name: interactive-picker-demo
description: Skill demo הממחיש ממשק ויזואלי אינטראקטיבי — מציג אפשרויות בחירה, המשתמש לוחץ, והתוצאה נשמרת ומוחזרת לסוכן.
metadata:
  display_name: "Interactive Picker Demo"
  required_tools: "run_shell_command, file_tool"
---

# Purpose

Skill הדגמה שמראה איך אפשר לבנות ממשק ויזואלי אינטראקטיבי (באמצעות `scripting-file`) שמחזיר מידע לסוכן.

הרעיון:
1. הסוכן מריץ סקריפט שיוצר קובץ `selection.json` (ריק בהתחלה)
2. הסוכן מציג ממשק בחירה בתוך `scripting-file`
3. המשתמש בוחר אפשרות (הקובץ נכתב)
4. הסוכן קורא את הקובץ ומקבל את הבחירה

# Instructions

1. הרץ את הסקריפט ליצירת קובץ התוצאה הריק:
   `scripting-ts run <skill_dir>/scripts/init-selection.ts --queryparameters '{"resultPath":"<skill_dir>/selection.json"}'`
   
2. צור ממשק `scripting-file` עם הקישורים/כפתורים שכותבים למיקום הזה.

3. קרא את `selection.json` אחרי שהמשתמש בחר כדי לקבל את התוצאה.

4. נקה את הקובץ אחרי השימוש.
