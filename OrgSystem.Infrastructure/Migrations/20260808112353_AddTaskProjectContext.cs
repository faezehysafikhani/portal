using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrgSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskProjectContext : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ProjectId",
                table: "Tasks",
                type: "text",
                nullable: true);

            migrationBuilder.Sql("UPDATE \"Tasks\" SET \"ProjectId\" = '1' WHERE \"ProjectId\" IS NULL;");

            migrationBuilder.CreateIndex(
                name: "IX_Tasks_TenantId_ProjectId_Status",
                table: "Tasks",
                columns: new[] { "TenantId", "ProjectId", "Status" },
                filter: "\"IsDeleted\" = FALSE");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tasks_TenantId_ProjectId_Status",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "Tasks");
        }
    }
}
