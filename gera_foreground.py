from PIL import Image
import os

img = Image.open("icone_control.png").convert("RGBA")

# Garante base quadrada sem cortar o conteúdo do ícone
side = max(img.size)
square = Image.new("RGBA", (side, side), (15, 23, 42, 255))
offset = ((side - img.width) // 2, (side - img.height) // 2)
square.paste(img, offset, img)

# Tamanhos padrão do foreground (um pouco maiores para comportar margem segura)
foreground_sizes = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

for folder, px in foreground_sizes.items():
    out_dir = os.path.join("android_icons", folder)
    os.makedirs(out_dir, exist_ok=True)

    # Coloca o ícone em ~72% do canvas para dar respiro nas bordas
    inner_px = int(px * 0.72)
    inner = square.resize((inner_px, inner_px), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    pos = ((px - inner_px) // 2, (px - inner_px) // 2)
    canvas.paste(inner, pos, inner)
    canvas.save(os.path.join(out_dir, "ic_launcher_foreground.png"), format="PNG")

print("Arquivos gerados com sucesso!")