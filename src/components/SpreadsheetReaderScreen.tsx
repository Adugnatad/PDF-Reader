import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Header } from './Header';
import { INITIAL_SHEET_ROWS } from '../data/mockData';
import { SheetRow } from '../types';

interface SpreadsheetReaderScreenProps {
  onBack: () => void;
  onShowToast: (msg: string) => void;
  fileName?: string;
}

export const SpreadsheetReaderScreen: React.FC<SpreadsheetReaderScreenProps> = ({
  onBack,
  onShowToast,
  fileName = 'Q3_Financial_Statements_Consolidated.xlsx',
}) => {
  const [rows, setRows] = useState<SheetRow[]>(INITIAL_SHEET_ROWS);
  const [activeTab, setActiveTab] = useState<string>('Q3 Overview');
  const [selectedCell, setSelectedCell] = useState<{
    id: string;
    rowNum: number;
    col: 'A' | 'B' | 'C' | 'D' | 'E';
    label: string;
    value: string;
    formula: string;
  }>({
    id: 'C13',
    rowNum: 13,
    col: 'C',
    label: 'Total Revenue',
    value: '$1,420,850.00',
    formula: '=SUM(C4:C12)',
  });

  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [showChartView, setShowChartView] = useState<boolean>(false);
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  const [searchTableQuery, setSearchTableQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);

  // Sorting
  const handleSortAZ = () => {
    const nextOrder = !sortAsc;
    setSortAsc(nextOrder);
    setRows((prev) =>
      [...prev].sort((a, b) =>
        nextOrder
          ? a.category.localeCompare(b.category)
          : b.category.localeCompare(a.category)
      )
    );
    onShowToast(`Sorted by Category (${nextOrder ? 'A to Z' : 'Z to A'})`);
  };

  // Filtered rows
  const displayedRows = useMemo(() => {
    return rows.filter((r) => {
      const matchFilter =
        selectedStatusFilter === 'All' || r.status === selectedStatusFilter;
      const matchSearch =
        !searchTableQuery ||
        r.category.toLowerCase().includes(searchTableQuery.toLowerCase()) ||
        r.shipped.toLowerCase().includes(searchTableQuery.toLowerCase()) ||
        r.revenue.toLowerCase().includes(searchTableQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [rows, selectedStatusFilter, searchTableQuery]);

  const tabs = ['Q3 Overview', 'Operating Expenses', 'Tax Amortization', 'CapEx Breakdown'];

  return (
    <View style={styles.container}>
      <Header
        title={fileName}
        onBack={onBack}
        onShowToast={onShowToast}
      />

      {/* Top Floating Formula & Action Bar */}
      <View style={styles.topFormulaBar}>
        {/* Formula Input Pill */}
        <View style={styles.formulaInputRow}>
          <View style={styles.cellRefBadge}>
            <Text style={styles.cellRefText}>{selectedCell.id}</Text>
          </View>
          <Text style={styles.fxSymbol}>fx</Text>
          <Text style={styles.formulaText}>{selectedCell.formula}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            onPress={() => setShowSearch(!showSearch)}
            style={[styles.toolIconBtn, showSearch && styles.toolIconBtnActive]}
          >
            <Ionicons name="search" size={17} color={showSearch ? '#0d0096' : '#c7c4d7'} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSortAZ}
            style={styles.toolIconBtn}
          >
            <MaterialIcons name={"sort-by-alpha" as any} size={17} color="#c7c4d7" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowFilterModal(!showFilterModal)}
            style={[styles.toolIconBtn, selectedStatusFilter !== 'All' && styles.toolIconBtnActive]}
          >
            <Ionicons
              name="filter-outline"
              size={17}
              color={selectedStatusFilter !== 'All' ? '#0d0096' : '#c7c4d7'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              const next = !showChartView;
              setShowChartView(next);
              onShowToast(next ? 'Generated Interactive Chart Preview' : 'Returned to Grid Matrix');
            }}
            style={[styles.toolIconBtn, showChartView && styles.toolIconBtnActive]}
          >
            <Ionicons
              name="stats-chart-outline"
              size={17}
              color={showChartView ? '#0d0096' : '#c7c4d7'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Optional Search Input */}
      {showSearch && (
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={16} color="#908fa0" />
          <TextInput
            placeholder="Search spreadsheet cells..."
            placeholderTextColor="#908fa0"
            value={searchTableQuery}
            onChangeText={setSearchTableQuery}
            style={styles.searchTextInput}
          />
          {searchTableQuery ? (
            <TouchableOpacity onPress={() => setSearchTableQuery('')}>
              <Ionicons name="close" size={16} color="#908fa0" />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Main Grid or Chart View */}
      {showChartView ? (
        <ScrollView style={styles.chartContainer} contentContainerStyle={styles.chartScroll}>
          <Text style={styles.chartTitle}>Q3 Performance Variance Analysis</Text>
          <Text style={styles.chartSubtitle}>Actual vs Projected Revenue & YoY Variance</Text>

          <View style={styles.chartCard}>
            {displayedRows.slice(0, 6).map((item) => {
              const yoyNum = parseFloat(item.yoy);
              const isPositive = !yoyNum || yoyNum >= 0;
              return (
                <View key={item.rowNum} style={styles.chartBarRow}>
                  <Text style={styles.chartBarLabel} numberOfLines={1}>
                    {item.category}
                  </Text>
                  <View style={styles.chartBarTrack}>
                    <View
                      style={[
                        styles.chartBarFill,
                        {
                          width: `${Math.min(100, Math.max(20, Math.abs(item.revenueNum / 3500)))}%`,
                          backgroundColor: isPositive ? '#10b981' : '#f43f5e',
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.chartBarValue,
                      { color: isPositive ? '#34d399' : '#fb7185' },
                    ]}
                  >
                    {item.yoy}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <ScrollView horizontal style={styles.gridHorizontalScroll}>
          <ScrollView style={styles.gridVerticalScroll} contentContainerStyle={styles.gridContainer}>
            {/* Spreadsheet Table Header */}
            <View style={styles.tableHeaderRow}>
              <View style={[styles.cell, styles.cornerCell]}>
                <Text style={styles.headerText}>#</Text>
              </View>
              <View style={[styles.cell, { width: 170 }]}>
                <Text style={styles.headerText}>A • CATEGORY</Text>
              </View>
              <View style={[styles.cell, { width: 120 }]}>
                <Text style={styles.headerText}>B • UNITS</Text>
              </View>
              <View style={[styles.cell, { width: 120 }]}>
                <Text style={styles.headerText}>C • REVENUE</Text>
              </View>
              <View style={[styles.cell, { width: 110 }]}>
                <Text style={styles.headerText}>D • YOY</Text>
              </View>
              <View style={[styles.cell, { width: 110 }]}>
                <Text style={styles.headerText}>E • STATUS</Text>
              </View>
            </View>

            {/* Rows */}
            {displayedRows.map((row, idx) => {
              const isSelected = selectedCell.rowNum === row.rowNum;
              const isPositive = !row.yoy.startsWith('-');
              return (
                <View
                  key={row.rowNum}
                  style={[styles.tableDataRow, isSelected && styles.tableDataRowSelected]}
                >
                  {/* Row Number */}
                  <View style={[styles.cell, styles.rowNumCell]}>
                    <Text style={styles.rowNumText}>{idx + 1}</Text>
                  </View>

                  {/* Col A */}
                  <TouchableOpacity
                    onPress={() =>
                      setSelectedCell({
                        id: `A${idx + 1}`,
                        rowNum: row.rowNum,
                        col: 'A',
                        label: row.category,
                        value: row.category,
                        formula: `="${row.category}"`,
                      })
                    }
                    style={[styles.cell, { width: 170 }]}
                  >
                    <Text style={styles.cellText} numberOfLines={1}>
                      {row.category}
                    </Text>
                  </TouchableOpacity>

                  {/* Col B */}
                  <TouchableOpacity
                    onPress={() =>
                      setSelectedCell({
                        id: `B${idx + 1}`,
                        rowNum: row.rowNum,
                        col: 'B',
                        label: row.category,
                        value: row.shipped,
                        formula: `=VALUE("${row.shipped}")`,
                      })
                    }
                    style={[styles.cell, { width: 120 }]}
                  >
                    <Text style={styles.cellText}>{row.shipped}</Text>
                  </TouchableOpacity>

                  {/* Col C */}
                  <TouchableOpacity
                    onPress={() =>
                      setSelectedCell({
                        id: `C${idx + 1}`,
                        rowNum: row.rowNum,
                        col: 'C',
                        label: row.category,
                        value: row.revenue,
                        formula: `=CURRENCY("${row.revenue}")`,
                      })
                    }
                    style={[styles.cell, { width: 120 }]}
                  >
                    <Text style={styles.cellText}>{row.revenue}</Text>
                  </TouchableOpacity>

                  {/* Col D */}
                  <TouchableOpacity
                    onPress={() =>
                      setSelectedCell({
                        id: `D${idx + 1}`,
                        rowNum: row.rowNum,
                        col: 'D',
                        label: row.category,
                        value: row.yoy,
                        formula: `="${row.yoy}"`,
                      })
                    }
                    style={[styles.cell, { width: 110 }]}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        { color: isPositive ? '#34d399' : '#fb7185', fontWeight: '600' },
                      ]}
                    >
                      {row.yoy}
                    </Text>
                  </TouchableOpacity>

                  {/* Col E */}
                  <TouchableOpacity
                    onPress={() =>
                      setSelectedCell({
                        id: `E${idx + 1}`,
                        rowNum: row.rowNum,
                        col: 'E',
                        label: row.category,
                        value: row.status,
                        formula: `="${row.status}"`,
                      })
                    }
                    style={[styles.cell, { width: 110 }]}
                  >
                    <Text style={styles.statusBadgeText}>{row.status}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </ScrollView>
      )}

      {/* Bottom Sheet Tabs Bar */}
      <View style={styles.sheetTabsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {tabs.map((tab) => {
            const isTabActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => {
                  setActiveTab(tab);
                  onShowToast(`Switched worksheet to: ${tab}`);
                }}
                style={[styles.sheetTab, isTabActive && styles.sheetTabActive]}
              >
                <Ionicons
                  name="grid"
                  size={14}
                  color={isTabActive ? '#0d0096' : '#908fa0'}
                />
                <Text style={[styles.sheetTabText, isTabActive && styles.sheetTabTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1326',
  },
  topFormulaBar: {
    backgroundColor: 'rgba(11, 19, 38, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(45, 52, 73, 0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 30,
  },
  formulaInputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171f33',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2d3449',
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  cellRefBadge: {
    backgroundColor: '#222a3d',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cellRefText: {
    color: '#c0c1ff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  fxSymbol: {
    color: '#908fa0',
    fontSize: 14,
    fontStyle: 'italic',
    fontFamily: 'serif',
  },
  formulaText: {
    color: '#dae2fd',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#171f33',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2d3449',
  },
  toolIconBtnActive: {
    backgroundColor: '#c0c1ff',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171f33',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3449',
    gap: 8,
  },
  searchTextInput: {
    flex: 1,
    color: '#dae2fd',
    fontSize: 13,
    paddingVertical: 0,
    outlineStyle: 'none' as any,
  },
  gridHorizontalScroll: {
    flex: 1,
  },
  gridVerticalScroll: {
    flex: 1,
  },
  gridContainer: {
    paddingBottom: 60,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#171f33',
    borderBottomWidth: 1,
    borderBottomColor: '#2d3449',
  },
  tableDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(45, 52, 73, 0.4)',
    backgroundColor: '#0b1326',
  },
  tableDataRowSelected: {
    backgroundColor: 'rgba(192, 193, 255, 0.08)',
  },
  cell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(45, 52, 73, 0.4)',
  },
  cornerCell: {
    width: 44,
    alignItems: 'center',
    backgroundColor: '#171f33',
  },
  rowNumCell: {
    width: 44,
    alignItems: 'center',
    backgroundColor: '#131b2e',
  },
  headerText: {
    color: '#908fa0',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  rowNumText: {
    color: '#908fa0',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  cellText: {
    color: '#dae2fd',
    fontSize: 12,
  },
  statusBadgeText: {
    color: '#7bd0ff',
    fontSize: 11,
    fontWeight: '600',
  },
  chartContainer: {
    flex: 1,
    backgroundColor: '#0b1326',
  },
  chartScroll: {
    padding: 20,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#dae2fd',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 12,
    color: '#908fa0',
    marginBottom: 20,
  },
  chartCard: {
    backgroundColor: '#171f33',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d3449',
    padding: 16,
    gap: 16,
  },
  chartBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chartBarLabel: {
    width: 130,
    fontSize: 12,
    color: '#dae2fd',
    fontWeight: '500',
  },
  chartBarTrack: {
    flex: 1,
    height: 12,
    backgroundColor: '#0b1326',
    borderRadius: 6,
    overflow: 'hidden',
  },
  chartBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  chartBarValue: {
    width: 60,
    fontSize: 11,
    textAlign: 'right',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  sheetTabsBar: {
    backgroundColor: '#131b2e',
    borderTopWidth: 1,
    borderTopColor: '#2d3449',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tabsScroll: {
    flexDirection: 'row',
    gap: 6,
  },
  sheetTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#171f33',
    gap: 6,
  },
  sheetTabActive: {
    backgroundColor: '#c0c1ff',
  },
  sheetTabText: {
    fontSize: 12,
    color: '#908fa0',
    fontWeight: '500',
  },
  sheetTabTextActive: {
    color: '#0d0096',
    fontWeight: '700',
  },
});
