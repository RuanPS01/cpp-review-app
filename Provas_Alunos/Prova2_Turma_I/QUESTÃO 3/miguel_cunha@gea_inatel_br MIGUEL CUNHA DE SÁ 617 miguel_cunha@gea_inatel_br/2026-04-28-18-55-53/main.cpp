#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    
    //declarando variaveis
    int n;
    double contador1 = 0;
    double contador2 = 0;
    double contador3 = 0;
    double contador4 = 0;
    double contador5 = 0;
    
    //dando entrada nas avaliaçoes e contando elas
    while(cin >> n && n != 6)
    {
        if(n == 1)
        {
            contador1++;
        }
        if(n == 2)
        {                
            contador2++;
        }
        if(n == 3)
        {
            contador3++;
        }
        if(n == 4)
        {
            contador4++;
        }
        if(n == 5)
        {
            contador5++;
        }
        cin >> n;
    }
    //saida de dados e manipulando variaveis
    cout << fixed << setprecision(2);
    cout << "1 estrelas: " << contador1 << "%" << endl;
    cout << "2 estrelas: " << contador2 << "%" << endl;
    cout << "3 estrelas: " << contador3 << "%" << endl;
    cout << "4 estrelas: " << contador4 << "%" << endl;
    cout << "5 estrelas: " << contador5 << "%" << endl;
    
    return 0;
}