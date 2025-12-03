import {
  FilterIcon,
  ImageIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const projectsList = [
  "Nikki Bella Pinup",
  "Taylor Synthwave",
  "Foxgirl Pastel",
  "Metal Divas",
];

const imageGridData = [
  { top: "top-[92px]", left: "left-[239px]" },
  { top: "top-[92px]", left: "left-[435px]" },
  { top: "top-[92px]", left: "left-[631px]" },
  { top: "top-[92px]", left: "left-[827px]" },
  { top: "top-[92px]", left: "left-[1023px]", double: true },
  { top: "top-[292px]", left: "left-[239px]" },
  { top: "top-[292px]", left: "left-[435px]" },
  { top: "top-[292px]", left: "left-[630px]", double: true },
  { top: "top-[292px]", left: "left-[1023px]", double: true },
  { top: "top-[492px]", left: "left-[239px]" },
  { top: "top-[492px]", left: "left-[435px]" },
  { top: "top-[492px]", left: "left-[631px]" },
  { top: "top-[492px]", left: "left-[827px]" },
  { top: "top-[496px]", left: "left-[1023px]", double: true },
  { top: "top-[692px]", left: "left-[239px]" },
  { top: "top-[692px]", left: "left-[435px]" },
  { top: "top-[692px]", left: "left-[630px]", double: true },
  { top: "top-[692px]", left: "left-[1023px]", double: true },
];

const imageInfo = [
  { label: "Resolution", value: "1024 × 1536" },
  { label: "Format", value: "JPG" },
  { label: "Size", value: "412 KB" },
  { label: "Source", value: "Bing" },
];

const tags = ["lingerie", "blonde", "studio", "nsfw", "pose", "shoulders-up"];

export const Desktop = (): JSX.Element => {
  return (
    <div className="bg-white w-full min-w-[1440px] min-h-[900px] relative">
      <div className="flex w-full h-[900px] bg-[#00000099] overflow-hidden">
        <aside className="w-[202px] h-full bg-[#141414] flex flex-col">
          <div className="p-[21px]">
            <img
              className="w-40 h-40 object-cover"
              alt="Lora craft"
              src="/figmaAssets/lora-craft-1.png"
            />
          </div>

          <div className="px-[21px] mt-[20px]">
            <Button className="w-full h-auto bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-[100px] px-4 py-2.5 gap-2">
              <PlusIcon className="w-5 h-5" />
              <span className="font-m3-label-large font-[number:var(--m3-label-large-font-weight)] text-[#eeeeee] text-[length:var(--m3-label-large-font-size)] tracking-[var(--m3-label-large-letter-spacing)] leading-[var(--m3-label-large-line-height)] [font-style:var(--m3-label-large-font-style)]">
                New Concept
              </span>
            </Button>
          </div>

          <nav className="mt-[71px] px-[14px] flex flex-col gap-2">
            {projectsList.map((project, index) => (
              <div key={index} className="relative">
                {index === 0 && (
                  <div className="absolute left-[-14px] top-0 w-1 h-[33px] bg-[#ff58a5]" />
                )}
                <Button
                  variant="ghost"
                  className={`w-full h-auto justify-start px-0 pr-4 py-2 rounded-md ${
                    index === 0
                      ? "bg-[#3c3c3c] hover:bg-[#3c3c3c]"
                      : "bg-transparent hover:bg-[#2a2a2a]"
                  }`}
                >
                  <span className="[font-family:'Inter',Helvetica] font-medium text-[#e8e8e8] text-sm tracking-[0] leading-[normal]">
                    {project}
                  </span>
                </Button>
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col bg-[#0f0f0f] border border-solid border-[#3a3a3a]">
          <header className="h-[60px] bg-[#1a1a1a] flex items-center gap-4 px-[41px]">
            <Select>
              <SelectTrigger className="w-auto h-8 bg-[#2a2a2a] border-0 rounded-lg shadow-box-shadow-shadow-xs gap-1.5 px-3">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="option1">Option 1</SelectItem>
                <SelectItem value="option2">Option 2</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1 max-w-[297px]">
              <Input
                placeholder="SearchIcon images..."
                className="h-8 bg-[#2a2a2a] border-0 rounded-lg pr-10 font-single-line-body-base font-[number:var(--single-line-body-base-font-weight)] text-neutral-200 text-[length:var(--single-line-body-base-font-size)] tracking-[var(--single-line-body-base-letter-spacing)] leading-[var(--single-line-body-base-line-height)] [font-style:var(--single-line-body-base-font-style)]"
              />
              <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-200" />
            </div>

            <Button
              variant="ghost"
              className="h-8 w-[35px] p-0 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-lg"
            >
              <FilterIcon className="w-5 h-5 text-neutral-200" />
            </Button>
          </header>

          <div className="flex-1 relative overflow-hidden">
            <img
              className="absolute top-[-1px] left-[922px] w-80 h-px object-cover"
              alt="Line"
              src="/figmaAssets/line-1.svg"
            />

            {imageGridData.map((item, index) => (
              <div
                key={index}
                className={`absolute ${item.top} ${item.left} ${
                  item.double ? "w-[377px]" : "w-[180px]"
                } h-[180px]`}
              >
                {item.double ? (
                  <div className="flex gap-[17px]">
                    <Card className="w-[180px] h-[180px] bg-[#1d1d1d] border-0 rounded-lg shadow-[0px_2px_6px_#000000]">
                      <CardContent className="p-3 h-full">
                        <div className="w-full h-full bg-[#2a2a2a] border border-solid border-[#3a3a3a] flex items-center justify-center">
                          <ImageIcon className="w-12 h-12 text-neutral-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="w-[180px] h-[180px] bg-[#1d1d1d] border-0 rounded-lg shadow-[0px_2px_6px_#000000]">
                      <CardContent className="p-3 h-full">
                        <div className="w-full h-full bg-[#2a2a2a] border border-solid border-[#3a3a3a] flex items-center justify-center">
                          <ImageIcon className="w-12 h-12 text-neutral-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card className="w-full h-full bg-[#1d1d1d] border-0 rounded-lg shadow-[0px_2px_6px_#000000]">
                    <CardContent className="p-3 h-full">
                      <div className="w-full h-full bg-[#2a2a2a] border border-solid border-[#3a3a3a] flex items-center justify-center">
                        <ImageIcon className="w-12 h-12 text-neutral-500" />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ))}
          </div>
        </main>

        <aside className="w-[322px] h-full bg-[#121212] border-l border-solid border-[#2c2c2c33] shadow-[-4px_0px_12px_30px_#0c0c0d0d] flex flex-col">
          <header className="h-[60px] flex items-center justify-center relative px-6">
            <h2 className="[font-family:'Inter',Helvetica] font-medium text-[#e8e8e8] text-base text-center tracking-[0] leading-[normal]">
              Image Details
            </h2>
            <Button
              variant="ghost"
              className="absolute right-6 top-1/2 -translate-y-1/2 h-auto w-auto p-0 hover:bg-transparent"
            >
              <XIcon className="w-5 h-5 text-white" />
            </Button>
          </header>

          <div className="flex-1 px-6 py-6 flex flex-col gap-6">
            <Card className="w-full h-[244px] bg-[#1e1e1e] border border-solid border-[#2a2a2a] shadow-[0px_4px_4px_#00000040] rounded-lg">
              <CardContent className="h-full flex items-center justify-center p-0">
                <ImageIcon className="w-12 h-12 text-neutral-500" />
              </CardContent>
            </Card>

            <section>
              <h3 className="[font-family:'Inter',Helvetica] font-medium text-white text-base tracking-[0] leading-[normal] mb-3">
                Info
              </h3>
              <div className="flex flex-col gap-1.5">
                {imageInfo.map((info, index) => (
                  <p
                    key={index}
                    className="[font-family:'Inter',Helvetica] font-normal text-[#bfbfbf] text-[13px] tracking-[0] leading-[normal]"
                  >
                    {info.label}: {info.value}
                  </p>
                ))}
              </div>
            </section>

            <section>
              <h3 className="[font-family:'Inter',Helvetica] font-medium text-white text-base tracking-[0] leading-[normal] mb-3">
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="bg-[#2a2a2a] hover:bg-[#2a2a2a] rounded-xl px-3 py-1 h-auto [font-family:'Inter',Helvetica] font-normal text-[#e0e0e0] text-sm text-center tracking-[0] leading-[normal]"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </section>

            <section>
              <h3 className="[font-family:'Inter',Helvetica] font-medium text-white text-base tracking-[0] leading-[normal] mb-3">
                Caption
              </h3>
              <Textarea
                placeholder="Write a caption..."
                className="w-full h-[72px] bg-[#2a2a2a] border border-solid rounded-lg shadow-[0px_4px_4px_#0000001a] resize-none [font-family:'Inter',Helvetica] font-normal text-[#9a9a9a] text-sm tracking-[0] leading-[normal] p-3"
              />
            </section>

            <Button className="w-full h-[41px] bg-[#3a3a3a] hover:bg-[#4a4a4a] rounded-lg shadow-[0px_2px_6px_#00000026] [font-family:'Inter',Helvetica] font-semibold text-white text-base tracking-[0] leading-[normal]">
              Add to Dataset
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
};
