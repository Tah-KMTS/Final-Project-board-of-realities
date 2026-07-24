import os, zipfile, glob

os.makedirs('public/assets/packs', exist_ok=True)
zips = [z for z in glob.glob('new files/*.zip') if 'Godot' not in z]
for z in zips:
    name = os.path.splitext(os.path.basename(z))[0]
    dest = os.path.join('public/assets/packs', name)
    os.makedirs(dest, exist_ok=True)
    try:
        with zipfile.ZipFile(z, 'r') as zf:
            for member in zf.infolist():
                try:
                    zf.extract(member, dest)
                except Exception as e:
                    pass
        print(f"Extracted {z}")
    except Exception as e:
        print(f"Failed {z}: {e}")
