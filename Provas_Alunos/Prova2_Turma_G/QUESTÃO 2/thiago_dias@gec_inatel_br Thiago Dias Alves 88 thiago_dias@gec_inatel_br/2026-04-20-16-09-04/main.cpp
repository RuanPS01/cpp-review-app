#include <iostream>
#include <iomanip>

using namespace std;

int main()
{
    int n,auxiliar,soma = 0,cont = 0;
    double media = 0;
    
    cin >> n;
    
    for(int i = 0; i < n; i++){
        cont++;
        cin >> auxiliar;
        soma += auxiliar;
    }
    
     media = (double)soma /cont;
    
    
    cout << fixed << setprecision(4) << media << endl;
    
    return 0;
}