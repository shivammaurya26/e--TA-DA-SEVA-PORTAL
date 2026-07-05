import re
file_path = r'e:\SHIVAM\PROJECT\e-TA DA SEVA PORTAL\e--TA-DA-SEVA-PORTAL\FRONTEND\script.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'fetch\("/api/', 'fetch("http://127.0.0.1:5000/api/', content)
content = re.sub(r'fetch\(`/api/', 'fetch(`http://127.0.0.1:5000/api/', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done patching')
