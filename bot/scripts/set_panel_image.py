from functions.database import database as db
images = db.get_document('custom_images') or {}
images['panel'] = 'https://media.discordapp.net/ephemeral-attachments/1514447098349752423/1518918435654991963/panel_banner.png?ex=6a3baa87&is=6a3a5907&hm=5c4e30cc362bfda0e52a37208c6b76a10bc4aa211cbf160d431ffcdd11787780&format=webp&quality=lossless&width=1568&height=725&'
db.save_document('custom_images', images)
print('Saved panel image')
