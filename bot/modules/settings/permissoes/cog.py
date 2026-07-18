import disnake
from disnake.ext import commands
from functions.emoji import emoji
from functions.database import database as db
from functions.message import message, embed_message
from functions.perms import perms


class GerenciarPermissoes(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @staticmethod
    def get_perms_users():
        """Retorna a lista de IDs de usuários com permissão (do MongoDB)"""
        return perms.get_all_users()

    @staticmethod
    def get_owner_id():
        """Retorna o ID do owner do bot"""
        return perms.get_owner_id()

    @staticmethod
    def panel(inter: disnake.MessageInteraction, bot: commands.Bot = None):
        """Retorna o painel de gerenciamento de permissões"""
        colors = db.get_document("custom_colors")
        primary_color_hex = colors.get("primary")
        
        container_kwargs = {}
        if primary_color_hex:
            primary_color = int(primary_color_hex.replace("#", ""), 16)
            container_kwargs["accent_colour"] = disnake.Colour(primary_color)
        
        # Obter lista de usuários com permissão
        perms_users = GerenciarPermissoes.get_perms_users()
        
        # Formatar lista de usuários
        if perms_users:
            users_text = ""
            for user_id in perms_users:
                users_text += f"{emoji.members} <@{user_id}>\n"
        else:
            users_text = f"{emoji.wrong} Nenhum usuário com acesso."
        
        components = [
            disnake.ui.Container(
                disnake.ui.TextDisplay(f"# {emoji.z0}{emoji.z1}{emoji.z2}{emoji.z3}{emoji.z4}\n-# Painel > Configurações > **Gerenciar Permissões**"),
                disnake.ui.Separator(),
                disnake.ui.TextDisplay(f"**Usuários com Acesso:**\n{users_text}"),
                disnake.ui.Separator(),
                disnake.ui.ActionRow(
                    disnake.ui.Button(
                        label="Adicionar",
                        style=disnake.ButtonStyle.green,
                        emoji=emoji.plus,
                        custom_id="Permissoes_Adicionar"
                    ),
                    disnake.ui.Button(
                        label="Remover",
                        style=disnake.ButtonStyle.danger,
                        emoji=emoji.minus,
                        custom_id="Permissoes_Remover"
                    ),
                ),
                **container_kwargs,
            ),
            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Voltar",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.back,
                    custom_id="Painel_Configuracoes"
                )
            )
        ]
        
        return {"components": components}

    @staticmethod
    def panel_embed(inter: disnake.MessageInteraction, bot: commands.Bot = None):
        """Retorna o painel em formato embed"""
        colors = db.get_document("custom_colors")
        primary_color_hex = colors.get("primary")
        
        # Obter lista de usuários com permissão
        perms_users = GerenciarPermissoes.get_perms_users()
        
        # Formatar lista de usuários
        if perms_users:
            users_text = ""
            for user_id in perms_users:
                users_text += f"{emoji.members} <@{user_id}>\n"
        else:
            users_text = f"{emoji.wrong} Nenhum usuário com acesso."
        
        embed = disnake.Embed(
            title="Gerenciar Permissões",
            description=(
                f"-# Painel > Configurações > **Gerenciar Permissões**\n\n"
                f"**Usuários com Acesso:**\n{users_text}"
            )
        )
        
        if primary_color_hex:
            primary_color = int(primary_color_hex.replace("#", ""), 16)
            embed.color = primary_color
        
        components = [
            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Adicionar",
                    style=disnake.ButtonStyle.green,
                    emoji=emoji.plus,
                    custom_id="Permissoes_Adicionar"
                ),
                disnake.ui.Button(
                    label="Remover",
                    style=disnake.ButtonStyle.danger,
                    emoji=emoji.minus,
                    custom_id="Permissoes_Remover"
                ),
            ),
            disnake.ui.ActionRow(
                disnake.ui.Button(
                    label="Voltar",
                    style=disnake.ButtonStyle.grey,
                    emoji=emoji.back,
                    custom_id="Painel_Configuracoes"
                )
            )
        ]
        
        return embed, components

    @commands.Cog.listener("on_button_click")
    async def on_button_click(self, inter: disnake.MessageInteraction):
        if inter.component.custom_id == "Permissoes_Adicionar":
            # Modal com UserSelect para adicionar usuário
            await inter.response.send_modal(
                title="Adicionar Usuário",
                custom_id="Permissoes_Adicionar_Modal",
                components=[
                    disnake.ui.Label(
                        text="Selecione o Usuário",
                        component=disnake.ui.UserSelect(
                            custom_id="user_select",
                            placeholder="Selecione um usuário para adicionar...",
                        ),
                        description="Escolha o usuário que receberá permissão de administrador do bot.",
                    )
                ]
            )
        
        elif inter.component.custom_id == "Permissoes_Remover":
            # Verificar se há usuários para remover
            perms_users = self.get_perms_users()
            
            if not perms_users:
                await inter.response.send_message(
                    f"{emoji.wrong} Não há usuários com permissão para remover.",
                    ephemeral=True
                )
                return
            
            # Modal com UserSelect para remover usuário
            await inter.response.send_modal(
                title="Remover Usuário",
                custom_id="Permissoes_Remover_Modal",
                components=[
                    disnake.ui.Label(
                        text="Selecione o Usuário",
                        component=disnake.ui.UserSelect(
                            custom_id="user_select",
                            placeholder="Selecione um usuário para remover...",
                        ),
                        description="Escolha o usuário que terá a permissão removida.",
                    )
                ]
            )
        
        elif inter.component.custom_id == "Permissoes_Voltar":
            mode = db.get_document("custom_mode").get("mode")
            if mode == "embed":
                await embed_message.wait(inter, send=False)
                embed, components = self.panel_embed(inter)
                await inter.edit_original_message(content=None, embed=embed, components=components)
            else:
                await message.wait(inter, send=False)
                panel = self.panel(inter, self.bot)
                await inter.edit_original_message(**panel, flags=disnake.MessageFlags(is_components_v2=True))

    @commands.Cog.listener("on_modal_submit")
    async def on_modal_submit(self, inter: disnake.ModalInteraction):
        if inter.custom_id == "Permissoes_Adicionar_Modal":
            # Obter usuário selecionado do UserSelect
            valores = inter.resolved_values
            user_select_values = valores.get("user_select", [])
            
            if not user_select_values:
                await inter.response.send_message(
                    f"{emoji.wrong} Você precisa selecionar um usuário!",
                    ephemeral=True
                )
                return
            
            # Extrair o ID do usuário selecionado
            selected_user = user_select_values[0] if isinstance(user_select_values, list) else user_select_values
            user_id = str(selected_user.id if hasattr(selected_user, 'id') else selected_user)
            
            # Verificar se usuário já tem permissão
            perms_users = self.get_perms_users()
            if user_id in perms_users:
                await inter.response.send_message(
                    f"{emoji.wrong} Este usuário já possui permissão!",
                    ephemeral=True
                )
                return
            
            # Adicionar usuário usando a nova classe perms
            perms.add_user(user_id)
            
            # Responder com sucesso - o painel será atualizado na próxima interação
            mode = db.get_document("custom_mode").get("mode")
            if mode == "embed":
                await embed_message.wait(inter, send=False)
                embed, components = self.panel_embed(inter)
                await inter.edit_original_message(content=None, embed=embed, components=components)
            else:
                await message.wait(inter, send=False)
                panel = self.panel(inter, self.bot)
                await inter.edit_original_message(**panel, flags=disnake.MessageFlags(is_components_v2=True))
        
        elif inter.custom_id == "Permissoes_Remover_Modal":
            # Obter usuário selecionado do UserSelect
            valores = inter.resolved_values
            user_select_values = valores.get("user_select", [])
            
            if not user_select_values:
                await inter.response.send_message(
                    f"{emoji.wrong} Você precisa selecionar um usuário!",
                    ephemeral=True
                )
                return
            
            # Extrair o ID do usuário selecionado
            selected_user = user_select_values[0] if isinstance(user_select_values, list) else user_select_values
            user_id = str(selected_user.id if hasattr(selected_user, 'id') else selected_user)
            
            # Verificar se usuário tem permissão
            perms_users = self.get_perms_users()
            if user_id not in perms_users:
                await inter.response.send_message(
                    f"{emoji.wrong} Este usuário não possui permissão!",
                    ephemeral=True
                )
                return
            
            # Verificar se é o owner (owner tem permissão automática, não está na lista)
            owner_id = self.get_owner_id()
            if user_id == owner_id:
                await inter.response.send_message(
                    f"{emoji.wrong} O dono do bot tem permissão automática e não está na lista!",
                    ephemeral=True
                )
                return
            
            # Remover usuário usando a nova classe perms
            perms.remove_user(user_id)
            
            # Responder com sucesso - o painel será atualizado na próxima interação
            mode = db.get_document("custom_mode").get("mode")
            if mode == "embed":
                await embed_message.wait(inter, send=False)
                embed, components = self.panel_embed(inter)
                await inter.edit_original_message(content=None, embed=embed, components=components)
            else:
                await message.wait(inter, send=False)
                panel = self.panel(inter, self.bot)
                await inter.edit_original_message(**panel, flags=disnake.MessageFlags(is_components_v2=True))


def setup(bot: commands.Bot):
    bot.add_cog(GerenciarPermissoes(bot))

