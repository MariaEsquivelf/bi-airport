/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

/**
 * Data Point Formatting Card
 */
class DataPointCardSettings extends FormattingSettingsCard {
    defaultColor = new formattingSettings.ColorPicker({
        name: "defaultColor",
        displayName: "Default color",
        value: { value: "#3498db" }
    });

    showAllDataPoints = new formattingSettings.ToggleSwitch({
        name: "showAllDataPoints",
        displayName: "Show all",
        value: true
    });

    fill = new formattingSettings.ColorPicker({
        name: "fill",
        displayName: "Fill",
        value: { value: "" }
    });

    fillRule = new formattingSettings.ColorPicker({
        name: "fillRule",
        displayName: "Color saturation",
        value: { value: "" }
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Text Size",
        value: 12
    });

    name: string = "dataPoint";
    displayName: string = "Data colors";
    slices: Array<FormattingSettingsSlice> = [this.defaultColor, this.showAllDataPoints, this.fill, this.fillRule, this.fontSize];
}

/**
 * Display Settings Card
 */
class DisplaySettingsCard extends FormattingSettingsCard {
    colorDimension = new formattingSettings.ItemDropdown({
        name: "colorDimension",
        displayName: "Color By",
        items: [
            { displayName: "Actual Color", value: "actualColor" },
            { displayName: "Airline", value: "airline" },
            { displayName: "Domestic/International", value: "domesticIntl" },
            { displayName: "Aircraft Model", value: "aircraftModel" },
            { displayName: "Terminal", value: "terminal" }
        ],
        value: { displayName: "Actual Color", value: "actualColor" }
    });

    rowHeight = new formattingSettings.NumUpDown({
        name: "rowHeight",
        displayName: "Row Height",
        value: 44,
        options: {
            minValue: { value: 30, type: powerbi.visuals.ValidatorType.Min },
            maxValue: { value: 100, type: powerbi.visuals.ValidatorType.Max }
        }
    });

    pxPerHour = new formattingSettings.NumUpDown({
        name: "pxPerHour",
        displayName: "Pixels Per Hour",
        value: 120,
        options: {
            minValue: { value: 60, type: powerbi.visuals.ValidatorType.Min },
            maxValue: { value: 300, type: powerbi.visuals.ValidatorType.Max }
        }
    });

    name: string = "display";
    displayName: string = "Display Settings";
    slices: Array<FormattingSettingsSlice> = [this.colorDimension, this.rowHeight, this.pxPerHour];
}

import powerbi from "powerbi-visuals-api";

/**
* visual settings model class
*
*/
export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    // Create formatting settings model formatting cards
    dataPointCard = new DataPointCardSettings();
    displayCard = new DisplaySettingsCard();

    cards = [this.displayCard, this.dataPointCard];
}
