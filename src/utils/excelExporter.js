/**
 * 高兼容性 Excel / CSV 报表导出工具
 * 原生支持 UTF-8 编码、中文无乱码、防止长数字(QQ/手机号)科学计数法截断
 */

function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCsvCell(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // 如果包含逗号、双引号、换行，则需用双引号包裹，并转义内部双引号
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 生成符合 Microsoft Excel 规范的 XML 电子表格 (.xls)
 * @param {Array<Object>} columns - 列定义 [{ title: '姓名', key: 'name', width: 120, type: 'String' }]
 * @param {Array<Object>} data - 数据列表
 * @param {string} sheetName - 工作表名称
 */
function buildExcelXml(columns, data, sheetName = '社团招新报名花名册') {
  const columnDefs = columns.map(col => `<Column ss:AutoFitWidth="1" ss:Width="${col.width || 120}"/>`).join('\n      ');
  
  const headerCells = columns.map(col => `
        <Cell ss:StyleID="HeaderStyle">
          <Data ss:Type="String">${escapeXml(col.title)}</Data>
        </Cell>`).join('');

  const rowsXml = data.map(item => {
    const cells = columns.map(col => {
      let rawVal = item[col.key];
      if (typeof col.format === 'function') {
        rawVal = col.format(rawVal, item);
      }
      const val = rawVal === null || rawVal === undefined ? '' : String(rawVal);
      const isNumber = col.type === 'Number' && !isNaN(Number(val)) && val !== '';
      const dataType = isNumber ? 'Number' : 'String';
      const styleId = isNumber ? 'NumberStyle' : 'TextStyle';
      return `
        <Cell ss:StyleID="${styleId}">
          <Data ss:Type="${dataType}">${escapeXml(val)}</Data>
        </Cell>`;
    }).join('');

    return `      <Row ss:AutoFitHeight="1">${cells}
      </Row>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Borders/>
      <Font ss:FontName="微软雅黑" ss:Size="10" ss:Color="#333333"/>
      <Interior/>
      <NumberFormat/>
      <Protection/>
    </Style>
    <Style ss:ID="HeaderStyle">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#cbd5e1"/>
      </Borders>
      <Font ss:FontName="微软雅黑" ss:Size="11" ss:Bold="1" ss:Color="#0f172a"/>
      <Interior ss:Color="#f1f5f9" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="TextStyle">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
      </Borders>
      <Font ss:FontName="微软雅黑" ss:Size="10" ss:Color="#334155"/>
      <NumberFormat ss:Format="@"/>
    </Style>
    <Style ss:ID="NumberStyle">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
      </Borders>
      <Font ss:FontName="微软雅黑" ss:Size="10" ss:Color="#334155"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(sheetName)}">
    <Table ss:DefaultRowHeight="24">
      ${columnDefs}
      <Row ss:Height="28">${headerCells}
      </Row>
${rowsXml}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <Selected/>
      <ProtectObjects>False</ProtectObjects>
      <ProtectScenarios>False</ProtectScenarios>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`;
}

/**
 * 生成带 UTF-8 BOM 的标准 CSV 内容
 */
function buildCsvWithBom(columns, data) {
  const headerRow = columns.map(col => escapeCsvCell(col.title)).join(',');
  const rows = data.map(item => {
    return columns.map(col => {
      let val = item[col.key];
      if (typeof col.format === 'function') {
        val = col.format(val, item);
      }
      return escapeCsvCell(val);
    }).join(',');
  });

  return '\uFEFF' + [headerRow, ...rows].join('\r\n');
}

module.exports = {
  buildExcelXml,
  buildCsvWithBom
};
