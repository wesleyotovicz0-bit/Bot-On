import py_compile
import os

base = r'c:\Users\2K relikia\Downloads\zenity'
files = [
    r'modules\automations\ai_chat\cog.py',
    r'modules\automations\ai_moderator\cog.py',
    r'modules\automations\boas_vindas\cog.py',
    r'modules\automations\clean\cog.py',
    r'modules\automations\cont_members\cog.py',
    r'modules\automations\cont_members_call\cog.py',
    r'modules\automations\cont_vendas\cog.py',
    r'modules\automations\feedbacks\cog.py',
    r'modules\automations\feedbacks\helpers.py',
    r'modules\automations\forms\cog.py',
    r'modules\automations\invite_tracker\cog.py',
    r'modules\automations\lock_unlock\cog.py',
    r'modules\automations\nuke\cog.py',
    r'modules\automations\reactions\cog.py',
    r'modules\automations\repost\cog.py',
    r'modules\automations\response_auto\cog.py',
    r'modules\automations\suggestions\cog.py',
    r'modules\automations\topics\cog.py',
    r'modules\cloud\cog.py',
    r'modules\automations\clean\helpers.py',
    r'modules\automations\nuke\helpers.py',
    r'modules\automations\repost\helpers.py',
    r'modules\settings\extensions\visiongen\cog.py',
]

ok = 0
fail = 0
for f in files:
    full = os.path.join(base, f)
    try:
        py_compile.compile(full, doraise=True)
        print('OK  ', f)
        ok += 1
    except py_compile.PyCompileError as e:
        print('FAIL', f)
        print('    ', str(e))
        fail += 1

print(f'\nResult: {ok} OK, {fail} FAIL')
