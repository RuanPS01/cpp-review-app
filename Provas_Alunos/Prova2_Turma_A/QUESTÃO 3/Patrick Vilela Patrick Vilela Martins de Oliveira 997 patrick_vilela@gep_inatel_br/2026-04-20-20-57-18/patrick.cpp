#include <iostream>
#include <cmath>
#include <iomanip>
#include <cstring>

using namespace std;

int main()
{
    int moedas;
    int caverna = 0;
    char i[1000];
    int j = 0;
    int total = 0;
    while(moedas != 0)
    {
        cin >> moedas;
        moedas = i[j];
        if(strcmp(i, "10") == 0)
        {
            caverna = j; 
        }
        total = total + moedas;
        j++;
    }
    cout << "Total de moedas: " << moedas << endl;
     cout << "Caverna com 10 moedas: " << caverna << endl;
    
    return 0;
}