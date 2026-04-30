#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    int n;
    double altura[1000];
    
    cin >> n;
    
    int i = 0;
    
    do
    {
        cin >> altura[i];
        
        i++;
    }
    while (i < n);
    
    double maioraltura = altura[0];
    double menoraltura = altura[0];
    
    for (int i = 0; i < n; i++)
    {
        if (altura[i] < menoraltura)
        {
            menoraltura = altura[i];
        }
        else if (altura[i] > maioraltura)
        {
            maioraltura = altura[i];
        }
    }
    
    cout << fixed << setprecision(2);
    cout << "Menor altura: "<< menoraltura << endl;
    cout << "Maior altura: " << maioraltura << endl;
    
    return 0;
}