using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrgSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSecureChatAttachmentsAndVoice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AttachmentContentType",
                table: "InternalChatMessages",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "AttachmentData",
                table: "InternalChatMessages",
                type: "varbinary(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AttachmentName",
                table: "InternalChatMessages",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AttachmentSize",
                table: "InternalChatMessages",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Kind",
                table: "InternalChatMessages",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "VoiceDurationSeconds",
                table: "InternalChatMessages",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AttachmentContentType",
                table: "InternalChatMessages");

            migrationBuilder.DropColumn(
                name: "AttachmentData",
                table: "InternalChatMessages");

            migrationBuilder.DropColumn(
                name: "AttachmentName",
                table: "InternalChatMessages");

            migrationBuilder.DropColumn(
                name: "AttachmentSize",
                table: "InternalChatMessages");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "InternalChatMessages");

            migrationBuilder.DropColumn(
                name: "VoiceDurationSeconds",
                table: "InternalChatMessages");
        }
    }
}
