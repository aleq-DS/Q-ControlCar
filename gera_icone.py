from PIL import Image

img = Image.open("icone_control.png").convert("RGBA")

# Garante base quadrada sem cortar o conteúdo do ícone
side = max(img.size)
square = Image.new("RGBA", (side, side), (15, 23, 42, 255))
offset = ((side - img.width) // 2, (side - img.height) // 2)
square.paste(img, offset, img)

# Gera PNG 1024x1024 e ICO multi-tamanho para o navegador
icon_1024 = square.resize((1024, 1024), Image.Resampling.LANCZOS)
icon_1024.save("icon_source.png", format="PNG")
icon_1024.save(
    "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
)

# Gera densidades padrão do Android
android_sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

for folder, px in android_sizes.items():
    out_dir = f"android_icons/{folder}"
    import os
    os.makedirs(out_dir, exist_ok=True)
    resized = square.resize((px, px), Image.Resampling.LANCZOS).convert("RGB")
    resized.save(f"{out_dir}/ic_launcher.png", format="PNG")
    resized.save(f"{out_dir}/ic_launcher_round.png", format="PNG")

print("Arquivos gerados com sucesso!")